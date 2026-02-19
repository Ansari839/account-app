/**
 * Seed script for RBAC Permissions and Default Roles.
 * Run: npx tsx prisma/seed-permissions.ts
 */
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Import centralized permission definitions
import { ALL_PERMISSIONS, DEFAULT_ROLES } from '../lib/permissions'

async function main() {
    console.log('🔐 Seeding Permissions...')

    // 1. Seed all permissions
    const permissionMap = new Map<string, string>() // "MODULE.ACTION" -> id
    for (const p of ALL_PERMISSIONS) {
        const existing = await prisma.permission.findFirst({
            where: { module: p.module, action: p.action }
        })
        if (existing) {
            permissionMap.set(`${p.module}.${p.action}`, existing.id)
            console.log(`  ✓ ${p.module}.${p.action} (exists)`)
        } else {
            const created = await prisma.permission.create({
                data: { module: p.module, action: p.action, description: p.description }
            })
            permissionMap.set(`${p.module}.${p.action}`, created.id)
            console.log(`  + ${p.module}.${p.action}`)
        }
    }

    console.log(`\n📋 Total permissions: ${permissionMap.size}`)

    // 2. Seed default roles for each company
    const companies = await prisma.company.findMany({ select: { id: true, name: true } })

    for (const company of companies) {
        console.log(`\n🏢 Setting up roles for: ${company.name}`)

        for (const roleDef of DEFAULT_ROLES) {
            // Upsert role
            const role = await prisma.role.upsert({
                where: { companyId_name: { companyId: company.id, name: roleDef.name } },
                update: { description: roleDef.description },
                create: {
                    name: roleDef.name,
                    description: roleDef.description,
                    companyId: company.id,
                }
            })

            // Clear existing role permissions and re-create
            await prisma.rolePermission.deleteMany({
                where: { roleId: role.id }
            })

            // Link permissions to role
            for (const permKey of roleDef.permissions) {
                const permId = permissionMap.get(permKey)
                if (permId) {
                    await prisma.rolePermission.create({
                        data: { roleId: role.id, permissionId: permId }
                    })
                }
            }

            console.log(`  ✓ Role "${roleDef.name}" → ${roleDef.permissions.length} permissions`)
        }

        // 3. Auto-assign ADMIN role to user-company entries with role 'ADMIN' or 'OWNER'
        const adminRole = await prisma.role.findUnique({
            where: { companyId_name: { companyId: company.id, name: 'ADMIN' } }
        })

        if (adminRole) {
            const adminUserCompanies = await prisma.userCompany.findMany({
                where: {
                    companyId: company.id,
                    role: { in: ['ADMIN', 'OWNER'] }
                }
            })

            for (const uc of adminUserCompanies) {
                await prisma.userRole.upsert({
                    where: { userId_roleId: { userId: uc.userId, roleId: adminRole.id } },
                    update: {},
                    create: { userId: uc.userId, roleId: adminRole.id }
                })
                console.log(`  ✓ Linked user ${uc.userId} → ADMIN role`)
            }
        }
    }

    // 4. Super admins get ADMIN role in all companies
    const superAdmins = await prisma.user.findMany({ where: { isSuperAdmin: true } })
    for (const admin of superAdmins) {
        for (const company of companies) {
            const adminRole = await prisma.role.findUnique({
                where: { companyId_name: { companyId: company.id, name: 'ADMIN' } }
            })
            if (adminRole) {
                await prisma.userRole.upsert({
                    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
                    update: {},
                    create: { userId: admin.id, roleId: adminRole.id }
                })
            }
        }
        console.log(`  👑 Super Admin ${admin.email} → ADMIN role in all companies`)
    }

    console.log('\n🎉 Permission seeding complete!')
}

main()
    .then(async () => { await prisma.$disconnect() })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
