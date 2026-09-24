const fs = require('fs');
const path = 'app/inventory/categories/[id]/edit/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Change component name
content = content.replace('export default function NewCategoryPage()', 'export default function EditCategoryPage({ params }: { params: { id: string } })');

// Change "New Category" to "Edit Category"
content = content.replace(/New Category/g, 'Edit Category');
content = content.replace(/'Save Category'/g, "'Update Category'");

// Add React hook for unwrapping params if needed in next.js 13+
content = content.replace('const [categories, setCategories] = useState<any[]>([]);', 
`const [categories, setCategories] = useState<any[]>([]);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const { id } = React.use(params as any);`);

// Fetch single category
content = content.replace(
`        const fetchCategories = async () => {
            try {
                const res = await authenticatedFetch('/api/inventory/categories');
                const json = await res.json();
                if (json.success) setCategories(json.data);
            } catch (e) {
                console.error(e);
            }
        };
        fetchCategories();
    }, []);`,
`        const fetchData = async () => {
            try {
                const [resCat, resAll] = await Promise.all([
                    authenticatedFetch(\`/api/inventory/categories/\${id}\`),
                    authenticatedFetch('/api/inventory/categories')
                ]);
                const jsonCat = await resCat.json();
                const jsonAll = await resAll.json();
                
                if (jsonCat.success) {
                    setFormData({
                        name: jsonCat.data.name,
                        parentId: jsonCat.data.parentId || ''
                    });
                }
                if (jsonAll.success) setCategories(jsonAll.data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsPageLoading(false);
            }
        };
        fetchData();
    }, [id]);`
);

// Change save logic
content = content.replace(
`            const res = await authenticatedFetch('/api/inventory/categories', {
                method: 'POST',`,
`            const res = await authenticatedFetch(\`/api/inventory/categories/\${id}\`, {
                method: 'PUT',`
);

// Add loading state rendering
content = content.replace('return (', 
`if (isPageLoading) return <MainLayout><div className="p-8 text-white">Loading...</div></MainLayout>;

    return (`);

fs.writeFileSync(path, content);
console.log("Updated Category Edit Page");
