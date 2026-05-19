import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GrEdit } from "react-icons/gr";
import { RiDeleteBin6Line } from "react-icons/ri";

interface Product {
    id: number;
    name: string;
    price: number;
    quantity: number;
    category: string[];
}

export const Dashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const dashboardIdStr = searchParams.get("id");
    const dashboardId = dashboardIdStr ? parseInt(dashboardIdStr, 10) : 0;
    const dashboardName = searchParams.get("name") || "Products";

    const [products, setProducts] = useState<Product[]>([]);
    const [searchTag, setSearchTag] = useState<string>("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);


    const fetchProducts = useCallback(async (tag: string = "") => {
        if (!dashboardId) {
            navigate("/");
            return;
        }

        try {
            const query = tag ? `&tag=${encodeURIComponent(tag)}` : "";
            const response = await fetch(`/api/products?dashboardId=${dashboardId}${query}`);
            if (response.status === 401) {
                navigate("/login");
                return;
            }
            const data = await response.json();
            setProducts(() => Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching products:", error);
        }
    }, [dashboardId, navigate]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleSearch = () => {
        setShowSuggestions(false);
        fetchProducts(searchTag);
    };

    const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTag(val);

        if (val.trim() === "") {
            setShowSuggestions(false);
            setSuggestions([]);
            setHighlightedIndex(-1);
            fetchProducts("");
            return;
        }

        const parts = val.split(",");
        const currentTerm = parts[parts.length - 1].trim();

        if (currentTerm.length >= 3) {
            try {
                const response = await fetch(`/api/tags?dashboardId=${dashboardId}&q=${encodeURIComponent(currentTerm)}`);
                if (response.ok) {
                    const data = await response.json();
                    setSuggestions(data || []);
                    setShowSuggestions(true);
                    setHighlightedIndex(-1);
                }
            } catch (err) {
                console.error("Error fetching suggestions:", err);
            }
        } else {
            setShowSuggestions(false);
            setSuggestions([]);
            setHighlightedIndex(-1);
        }
    };

    const handleClearSearch = () => {
        setSearchTag("");
        setShowSuggestions(false);
        setSuggestions([]);
        setHighlightedIndex(-1);
        fetchProducts("");
    };

    const handleSuggestionClick = (suggestion: string) => {
        const parts = searchTag.split(",");
        parts.pop();
        const newTagString = parts.length > 0
            ? parts.map(p => p.trim()).join(", ") + ", " + suggestion + ", "
            : suggestion + ", ";

        setSearchTag(newTagString);
        setShowSuggestions(false);
        setSuggestions([]);
        setHighlightedIndex(-1);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (showSuggestions && suggestions.length > 0) {
                setHighlightedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (showSuggestions && suggestions.length > 0) {
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (showSuggestions && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                handleSuggestionClick(suggestions[highlightedIndex]);
            } else {
                handleSearch();
            }
        }
    };
    const handleUpdate = (product: Product) => {
        navigate(`/update-product?dashboardId=${dashboardId}`, { state: { product } });
    };

    const handleDelete = async (id: number) => {
        try {
            const response = await fetch(`/api/products/${id}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            if (response.ok) {
                setProducts(prevProducts => prevProducts.filter(product => product.id !== id));
            } else {
                const result = await response.json();
                console.error("Delete failed:", result.error_message);
            }
        } catch (error) {
            console.error("Error:", error);
        }
    };


    return (
        <div className="container mx-auto px-4 sm:px-8">
            <div className="py-8">
                <div className="flex flex-row mb-1 sm:mb-0 justify-between items-center w-full">
                    <h2 className="text-2xl font-semibold leading-tight">{dashboardName} - Products</h2>
                </div>
                <div className="my-4 p-4 bg-gray-50 border-2 border-indigo-100 rounded-lg shadow-sm flex flex-col sm:flex-row items-center gap-4 w-full">
                    <div className="w-full flex-grow relative flex items-center">
                        <input
                            type="text"
                            placeholder="Search products by tag (e.g., ofis, kırtasiye)"
                            value={searchTag}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            className="block bg-white w-full rounded-md border-0 px-3 py-2 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        />
                        {searchTag && (
                            <button
                                onClick={handleClearSearch}
                                title="temizle"
                                className="absolute right-2 text-gray-400 hover:text-red-500 focus:outline-none"
                            >
                                <RiDeleteBin6Line size={18} />
                            </button>
                        )}
                        {showSuggestions && suggestions.length > 0 && (
                            <ul className="absolute top-full left-0 z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
                                {suggestions.map((suggestion, idx) => (
                                    <li
                                        key={idx}
                                        className={`px-4 py-2 cursor-pointer text-sm text-gray-700 ${idx === highlightedIndex ? 'bg-indigo-100 font-medium' : 'hover:bg-indigo-50'}`}
                                        onClick={() => handleSuggestionClick(suggestion)}
                                    >
                                        {suggestion}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <button
                        onClick={handleSearch}
                        className="w-full sm:w-auto rounded-lg text-sm px-6 py-2 transition-all bg-indigo-600 text-white hover:bg-indigo-700 font-semibold"
                    >
                        Search
                    </button>
                </div>

                <div className="-mx-4 sm:-mx-8 px-4 sm:px-8 py-4 overflow-x-auto">
                    <div className="inline-block min-w-full shadow-md rounded-lg overflow-hidden">
                        <table className="min-w-full leading-normal">
                            <thead>
                            <tr>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Name
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Price
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Quantity
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Total Price
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody>
                            {products.map((product, index) => (
                                <tr key={index}>
                                    <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">{product.name}</p>
                                    </td>
                                    <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">
                                            {new Intl.NumberFormat('en-US', {
                                                style: 'currency',
                                                currency: 'USD'
                                            }).format(product.price)}
                                        </p>
                                    </td>
                                    <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">{product.quantity}</p>
                                    </td>
                                    <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">
                                            {new Intl.NumberFormat('en-US', {
                                                style: 'currency',
                                                currency: 'USD'
                                            }).format(parseFloat((product.quantity * product.price).toFixed(2)))}
                                        </p>
                                    </td>
                                    <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                        <p className="text-gray-900 whitespace-no-wrap">{product.category ? product.category.join(", ") : ""}</p>
                                    </td>
                                    <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm flex flex-row items-center">
                                        <button
                                            onClick={() => handleUpdate(product)}
                                            className="text-lg"
                                        >
                                            <GrEdit/>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(product.id)}
                                            className="text-xl ml-5"
                                        >
                                            <RiDeleteBin6Line/>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="mt-8">
                    <Link to={`/add-product?dashboardId=${dashboardId}`}
                          className="rounded-lg border-2 border-solid bg-transparent px-4 py-2 transition-all border-black text-black hover:bg-[#dedede]"
                    >Add Product
                    </Link>
                </div>
            </div>
        </div>
    );
};
