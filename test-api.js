const http = require('http');

async function test() {
    // 1. Get the parent ID directly from DB
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const parent = await prisma.account.findFirst({ where: { code: '2210' } });
    if (!parent) return console.log("Parent 2210 not found");
    const pid = parent.id;
    const cid = parent.companyId;

    console.log("Parent ID:", pid, "Company ID:", cid);

    // 2. Fetch the API
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: `/api/accounts?suggestCode=true&parentId=${pid}`,
        method: 'GET',
        headers: {
            'x-company-id': cid
        }
    };

    const req = http.request(options, res => {
        console.log(`STATUS: ${res.statusCode}`);
        res.on('data', d => {
            process.stdout.write(d);
        });
    });

    req.on('error', error => {
        console.error(error);
    });

    req.end();
}

test();
