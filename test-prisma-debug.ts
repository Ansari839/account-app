import prisma from './lib/prisma';
async function main() {
  try {
    const user = await prisma.user.findFirst({ where: { email: "admin@antigravity.erp" } });
    console.log('Success:', user);
  } catch (e) {
    console.error('Error Object:', e);
    console.error('Error Message:', e.message);
  }
}
main();
