# Production Workflow & Deployment Guide

## Overview

This document outlines the workflow for deploying and running the project in a production environment.

## Prerequisites

- **Node.js**: LTS version.
- **Database**: PostgreSQL (Production ready instance, e.g., AWS RDS, DigitalOcean, Supabase).
- **Environment Variables**: A `.env.production` file or environment variables set in the host.

## Workflow

### 1. Build Phase

The application must be built before meaningful execution.

```bash
# Install dependencies (production only)
npm ci --legacy-peer-deps

# Generate Prisma Client
npx prisma generate

# Build the Next.js application
npm run build
```

### 2. Database Migration

**Critical**: Never use `prisma push` in production. Always use migrations.

```bash
# Apply pending migrations
npx prisma migrate deploy
```

### 3. Start Application

```bash
# Start the production server
npm start
```

## Production Checklist

- [ ] **Financial Year**: Ensure a defined Financial Year exists and is active.
- [ ] **Super Admin**: A default Super Admin should be seeded if not present.
- [ ] **Global Settings**: Ensure default currency and tax modes are set.
- [ ] **HTTPS**: Ensure SSL is enabled.
- [ ] **Backups**: Database automated backups should be enabled (Point-in-time recovery recommended).

## Troubleshooting

- **500 Errors**: Check `AuditLog` table for internal errors if API logs are silent.
- **Login Issues**: Verify `is_open` status of master tables if related to transactional blocks.
