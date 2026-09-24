import { AuthUtils } from '../lib/auth-utils';
import { CategoryService } from '../services/category.service';
import prisma from '../lib/prisma';

async function main() {
  try {
    const cat = await prisma.category.findFirst();
    if (!cat) return console.log("No categories");
    const res = await CategoryService.update(cat.id, { name: cat.name + " Test", isService: true, parentId: "" });
    console.log("Success:", res);
  } catch (e: any) {
    console.error("Error from CategoryService.update:", e.message);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
