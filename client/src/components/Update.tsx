import { useLocation, useNavigate } from "react-router-dom";
import { FormEvent, useState, useEffect, ChangeEvent, KeyboardEvent } from "react";

interface Product {
    id: number;
    name: string;
    price: number;
    quantity: number;
    category: string[];
}

export const Update = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const dashboardId = parseInt(searchParams.get("dashboardId") || "0", 10);
    const product = location.state?.product as Product | undefined;

    const [name, setName] = useState(product?.name || "");
    const [price, setPrice] = useState(product?.price || 0);
    const [quantity, setQuantity] = useState(product?.quantity || 0);
    const [category, setCategory] = useState(product?.category ? product.category.join(", ") : "");
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

    useEffect(() => {
        const fetchTags = async () => {
            if (!dashboardId || !product) {
                navigate("/");
                return;
            }

            try {
                const res = await fetch(`/api/products?dashboardId=${dashboardId}`);
                if (res.ok) {
                    const products: Product[] = await res.json();
                    const tags = Array.from(new Set(products.flatMap((p: Product) => p.category || [])));
                    setAvailableTags(tags);
                }
            } catch (err) {
                console.error("Failed to fetch tags", err);
            }
        };
        fetchTags();
    }, [dashboardId, navigate, product]);

    const handleCategoryChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCategory(value);

        const parts = value.split(",");
        const lastPart = parts[parts.length - 1];
        const searchStr = lastPart.trim().toLowerCase();

        if (searchStr.length > 0) {
            const currentTags = parts.slice(0, -1).map(p => p.trim().toLowerCase());
            const filtered = availableTags.filter(t =>
                t.toLowerCase().startsWith(searchStr) &&
                t.toLowerCase() !== searchStr &&
                !currentTags.includes(t.toLowerCase())
            );
            setSuggestions(filtered);
            setActiveSuggestionIndex(0);
        } else {
            setSuggestions([]);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (suggestions.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveSuggestionIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            acceptSuggestion(suggestions[activeSuggestionIndex]);
        }
    };

    const acceptSuggestion = (suggestion: string) => {
        const parts = category.split(",");
        parts.pop();
        const prefix = parts.length > 0 ? parts.join(",") + ", " : "";
        setCategory(prefix + suggestion + ", ");
        setSuggestions([]);
    };

    const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!product) {
            navigate("/");
            return;
        }

        const tags = category.split(",").map(t => t.trim()).filter(t => t !== "");
        const hasSpaces = tags.some(t => t.includes(" "));

        if (hasSpaces) {
            alert("Kategori etiketleri boşluk içeremez! Lütfen birden çok kelimeyi bağlarken alt tire (_) kullanın.");
            return;
        }

        const sanitizedCategories = Array.from(new Set(tags.map((t) => t.toLowerCase())));

        const updatedProduct = { dashboardId, name, price, quantity, category: sanitizedCategories };

        try {
            const response = await fetch(`/api/products/${product.id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(updatedProduct)
            });

            if (response.ok) {
                navigate(`/dashboard?id=${dashboardId}`);
            } else {
                console.error("Update failed");
            }
        } catch (error) {
            console.error("Error:", error);
        }
    };

    return (
        <div className="flex items-center justify-center h-[80vh]">
            <div className="flex min-h-full flex-1 flex-col justify-center items-center px-6 py-12 lg:px-8">
                <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
                    <h2 className="text-2xl mb-8 font-semibold leading-tight">Update Product</h2>
                    <form onSubmit={handleUpdate} className="space-y-6 text-left">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium leading-6 text-gray-900">
                                Name
                            </label>
                            <input
                                id="name"
                                name="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="block w-full rounded-md border-0 px-2 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            />
                        </div>

                        <div>
                            <label htmlFor="price" className="block text-sm font-medium leading-6 text-gray-900">
                                Price
                            </label>
                            <input
                                id="price"
                                name="price"
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(Number(e.target.value))}
                                required
                                className="block w-full rounded-md border-0 px-2 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            />
                        </div>
                        <div>
                            <label htmlFor="quantity" className="block text-sm font-medium leading-6 text-gray-900">
                                Quantity
                            </label>
                            <input
                                id="quantity"
                                name="quantity"
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                required
                                className="block w-full rounded-md border-0 px-2 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            />
                        </div>
                        <div className="relative">
                            <label htmlFor="category" className="block text-sm font-medium leading-6 text-gray-900">
                                Category
                            </label>
                            <input
                                id="category"
                                name="category"
                                type="text"
                                value={category}
                                onChange={handleCategoryChange}
                                onKeyDown={handleKeyDown}
                                required
                                autoComplete="off"
                                className="block w-full rounded-md border-0 px-2 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                            />
                            {suggestions.length > 0 && (
                                <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                    {suggestions.map((suggestion, index) => (
                                        <li
                                            key={suggestion}
                                            onClick={() => acceptSuggestion(suggestion)}
                                            className={`relative cursor-default select-none py-2 pl-3 pr-9 cursor-pointer ${
                                                index === activeSuggestionIndex ? "bg-indigo-600 text-white" : "text-gray-900 hover:bg-gray-100"
                                            }`}
                                        >
                                            {suggestion}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div>
                            <button
                                type="submit"
                                className="flex w-full justify-center rounded-md bg-black px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-[#434343] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                                Update Product
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
