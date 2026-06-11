import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { GrEdit } from "react-icons/gr";
import { RiDeleteBin6Line } from "react-icons/ri";
import Cookies from "js-cookie";
import { generateProductFields } from "../lib/ai-client";
import type { ColumnDefinition } from "../lib/ai-client";
import { DynamicAddForm } from "./Add";

interface Product {
    id: number;
    name: string;
    price: number;
    quantity: number;
    category: string[];
    customData?: Record<string, unknown>;
}

export const Dashboard = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const dashboardIdStr = searchParams.get("id");
    const dashboardId = dashboardIdStr ? parseInt(dashboardIdStr, 10) : 0;
    const dashboardName = searchParams.get("name") || "Products";

    const stateColumns: ColumnDefinition[] = (location.state as { columnDefinitions?: ColumnDefinition[] } | null)?.columnDefinitions ?? [];

    const userRole = (() => {
        try {
            const token = Cookies.get("token");
            if (!token) return "";
            return JSON.parse(atob(token.split(".")[1])).role as string;
        } catch {
            return "";
        }
    })();
    const canDeleteDashboard = userRole === "admin" || userRole === "super_user";

    const [products, setProducts] = useState<Product[]>([]);
    const [searchTag, setSearchTag] = useState<string>("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const [customColumns, setCustomColumns] = useState<ColumnDefinition[]>(stateColumns);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
    const [deleteError, setDeleteError] = useState<string>("");

    const [showAIModal, setShowAIModal] = useState(false);
    const [aiStep, setAiStep] = useState<"input" | "form">("input");
    const [aiImage, setAiImage] = useState<File | null>(null);
    const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
    const [aiDragOver, setAiDragOver] = useState(false);
    const [aiFileError, setAiFileError] = useState("");
    const [aiDescription, setAiDescription] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState("");
    const [aiPrefillValues, setAiPrefillValues] = useState<Record<string, string>>({});
    const aiFileInputRef = useRef<HTMLInputElement>(null);


    const fetchProducts = useCallback(async () => {
        if (!dashboardId) {
            navigate("/");
            return;
        }

        try {
            const response = await fetch(`/api/products?dashboardId=${dashboardId}`);
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

    useEffect(() => {
        if (!dashboardId || stateColumns.length > 0) return;
        fetch(`/api/dashboards/${dashboardId}`, {
            headers: { Authorization: `Bearer ${Cookies.get("token")}` },
        })
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (Array.isArray(data?.columnDefinitions) && data.columnDefinitions.length > 0) {
                    setCustomColumns(data.columnDefinitions);
                }
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dashboardId]);

    // 3+ harfli her terim, ürünün görünen tüm alanlarında (ad, etiketler, özel sütunlar) substring olarak aranır
    const normalizeText = (s: string) => s.toLocaleLowerCase("tr-TR");

    const productMatchesTerm = (product: Product, term: string): boolean => {
        const haystack: string[] = [product.name ?? ""];
        if (Array.isArray(product.category)) haystack.push(...product.category);
        if (product.customData) {
            for (const val of Object.values(product.customData)) {
                if (Array.isArray(val)) haystack.push(...val.map(String));
                else if (val !== null && val !== undefined) haystack.push(String(val));
            }
        }
        const needle = normalizeText(term);
        return haystack.some(h => normalizeText(h).includes(needle));
    };

    const searchTerms = searchTag
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length >= 3);

    const visibleProducts = searchTerms.length === 0
        ? products
        : products.filter(p => searchTerms.every(term => productMatchesTerm(p, term)));

    const handleSearch = () => {
        setShowSuggestions(false);
    };

    const handleInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearchTag(val);

        if (val.trim() === "") {
            setShowSuggestions(false);
            setSuggestions([]);
            setHighlightedIndex(-1);
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


    const handleDashboardDelete = async () => {
        setDeleteLoading(true);
        setDeleteError("");
        try {
            const response = await fetch(`/api/dashboards/${dashboardId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${Cookies.get("token")}` },
            });
            if (response.ok) {
                navigate("/");
                return;
            }
            const data = await response.json().catch(() => ({}));
            setDeleteError(data.error_message || "Tablo silinemedi. Lütfen tekrar deneyin.");
        } catch {
            setDeleteError("Bağlantı hatası. Lütfen tekrar deneyin.");
        } finally {
            setDeleteLoading(false);
        }
    };

    const resetAIModal = () => {
        setAiStep("input");
        setAiImage(null);
        setAiImagePreview(null);
        setAiDragOver(false);
        setAiFileError("");
        setAiDescription("");
        setAiLoading(false);
        setAiError("");
        setAiPrefillValues({});
    };

    const applyAIFile = (file: File) => {
        setAiFileError("");
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            setAiFileError("Sadece JPG, PNG veya WebP dosyası yükleyebilirsiniz.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            setAiFileError("Dosya boyutu 10 MB'ı aşamaz.");
            return;
        }
        // Bozuk dosyayı AI'a göndermeden yakala: tarayıcıda decode edilemeyen görsel reddedilir
        const url = URL.createObjectURL(file);
        const probe = new Image();
        probe.onload = () => {
            setAiImage(file);
            setAiImagePreview(url);
        };
        probe.onerror = () => {
            URL.revokeObjectURL(url);
            setAiFileError("Görsel okunamadı — dosya bozuk olabilir. Başka bir görsel deneyin.");
        };
        probe.src = url;
    };

    const buildExistingTags = (): Record<string, string[]> => {
        const result: Record<string, string[]> = {};
        for (const col of customColumns.filter(c => c.type === "tag")) {
            const tagSet = new Set<string>();
            for (const product of products) {
                const val = product.customData?.[col.name];
                if (Array.isArray(val)) val.forEach((t: unknown) => { if (typeof t === "string") tagSet.add(t); });
            }
            if (tagSet.size > 0) result[col.name] = [...tagSet];
        }
        return result;
    };

    const buildPrefillValues = (
        fields: Record<string, string | number | string[] | null>
    ): Record<string, string> => {
        const result: Record<string, string> = {};
        for (const col of customColumns) {
            const val = fields[col.name];
            if (val === null || val === undefined) continue;
            if (col.type === "metin") {
                result[col.name] = typeof val === "string" ? val : String(val);
            } else if (col.type === "adet") {
                const n = typeof val === "number" ? Math.trunc(val) : parseInt(String(val));
                if (!isNaN(n)) result[col.name] = String(n);
            } else if (col.type === "sayı") {
                const n = typeof val === "number" ? val : parseFloat(String(val));
                if (!isNaN(n)) result[col.name] = String(n);
            } else if (col.type === "tag") {
                const arr = Array.isArray(val) ? val.filter((v): v is string => typeof v === "string") : [];
                if (arr.length > 0) result[col.name] = arr.join(", ") + ", ";
            }
        }
        return result;
    };

    const handleAIGenerate = async () => {
        if ((!aiImage && !aiDescription.trim()) || aiLoading) return;
        setAiLoading(true);
        setAiError("");
        try {
            const existingTags = buildExistingTags();
            const result = await generateProductFields({
                description: aiDescription.trim() || undefined,
                image: aiImage ?? undefined,
                tableSchema: customColumns,
                existingTags: Object.keys(existingTags).length > 0 ? existingTags : undefined,
            });
            setAiPrefillValues(buildPrefillValues(result.fields));
            setAiStep("form");
        } catch (err: unknown) {
            setAiError(
                err instanceof Error
                    ? err.message
                    : "Beklenmedik bir hata oluştu, lütfen tekrar deneyin."
            );
        } finally {
            setAiLoading(false);
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
                            placeholder="Ürün adı veya etiket ara (en az 3 harf)"
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
                                {customColumns.length > 0 ? (
                                    <>
                                        {customColumns.map(col => (
                                            <th key={col.name} className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                {col.name}
                                            </th>
                                        ))}
                                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                            İşlemler
                                        </th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantity</th>
                                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Price</th>
                                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                                        <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                    </>
                                )}
                            </tr>
                            </thead>
                            <tbody>
                            {customColumns.length > 0 ? (
                                visibleProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={customColumns.length + 1} className="px-5 py-8 text-center text-sm text-gray-400 bg-white">
                                            {products.length === 0 ? "Henüz ürün eklenmedi." : "Aramayla eşleşen ürün bulunamadı."}
                                        </td>
                                    </tr>
                                ) : (
                                    visibleProducts.map((product, index) => (
                                        <tr key={index}>
                                            {customColumns.map(col => {
                                                const val = product.customData?.[col.name];
                                                let display = "—";
                                                if (Array.isArray(val)) display = val.join(", ") || "—";
                                                else if (val !== undefined && val !== null && val !== "") display = String(val);
                                                return (
                                                    <td key={col.name} className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                                        <p className="text-gray-900">{display}</p>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm flex flex-row items-center">
                                                <button onClick={() => handleUpdate(product)} className="text-lg"><GrEdit /></button>
                                                <button onClick={() => handleDelete(product.id)} className="text-xl ml-5"><RiDeleteBin6Line /></button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : visibleProducts.length === 0 && products.length > 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400 bg-white">
                                        Aramayla eşleşen ürün bulunamadı.
                                    </td>
                                </tr>
                            ) : (
                                visibleProducts.map((product, index) => (
                                    <tr key={index}>
                                        <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">{product.name}</p>
                                        </td>
                                        <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(product.price)}
                                            </p>
                                        </td>
                                        <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">{product.quantity}</p>
                                        </td>
                                        <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">
                                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat((product.quantity * product.price).toFixed(2)))}
                                            </p>
                                        </td>
                                        <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm">
                                            <p className="text-gray-900 whitespace-no-wrap">{product.category ? product.category.join(", ") : ""}</p>
                                        </td>
                                        <td className="px-5 py-5 border-b text-left border-gray-200 bg-white text-sm flex flex-row items-center">
                                            <button onClick={() => handleUpdate(product)} className="text-lg"><GrEdit /></button>
                                            <button onClick={() => handleDelete(product.id)} className="text-xl ml-5"><RiDeleteBin6Line /></button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="mt-8 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Link to={`/add-product?dashboardId=${dashboardId}`}
                              className="rounded-lg border-2 border-solid bg-transparent px-4 py-2 transition-all border-black text-black hover:bg-[#dedede]"
                        >Ürün Ekle
                        </Link>
                        {customColumns.length > 0 && (
                            <button
                                onClick={() => { resetAIModal(); setShowAIModal(true); }}
                                className="rounded-lg border-2 border-solid bg-transparent px-4 py-2 transition-all border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                            >
                                ✨ Akıllı Ürün Ekle
                            </button>
                        )}
                    </div>
                    {canDeleteDashboard && (
                        <button
                            onClick={() => { setShowDeleteConfirm(true); setDeleteError(""); }}
                            className="rounded-lg border-2 border-solid bg-transparent px-4 py-2 transition-all border-red-600 text-red-600 hover:bg-red-50"
                        >
                            Tabloyu Sil
                        </button>
                    )}
                </div>
            </div>

            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Tabloyu Sil</h3>
                        <p className="text-sm text-gray-600 mb-1">
                            <span className="font-medium text-gray-800">"{dashboardName}"</span> tablosunu silmek istediğinizden emin misiniz?
                        </p>
                        <p className="text-sm text-red-600 mb-4">
                            Bu işlem geri alınamaz. Tablodaki tüm ürünler ve izinler kalıcı olarak silinecektir.
                        </p>
                        {deleteError && (
                            <p className="text-sm text-red-500 mb-4 p-2 bg-red-50 rounded">{deleteError}</p>
                        )}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => { setShowDeleteConfirm(false); setDeleteError(""); }}
                                disabled={deleteLoading}
                                className="px-4 py-2 text-sm rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleDashboardDelete}
                                disabled={deleteLoading}
                                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleteLoading ? "Siliniyor..." : "Evet, Sil"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">

                        {/* Başlık */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xl" aria-hidden>✨</span>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {aiStep === "input" ? "Akıllı Ürün Ekle" : "AI Önerilerini Düzenle"}
                                </h3>
                            </div>
                            <button
                                onClick={() => { setShowAIModal(false); resetAIModal(); }}
                                disabled={aiLoading}
                                className="text-gray-400 hover:text-gray-600 disabled:opacity-50 text-xl leading-none"
                                aria-label="Kapat"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Adım 1: Görsel + Metin */}
                        {aiStep === "input" && (
                            <div className="flex flex-col gap-5">
                                <p className="text-sm text-gray-500">
                                    Görsel ve/veya açıklama girin — AI ürün alanlarını otomatik dolduracak. En az biri zorunludur.
                                </p>

                                {/* Görsel yükleme */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Görsel <span className="text-gray-400 font-normal">(opsiyonel — JPG, PNG, WebP, maks. 10 MB)</span>
                                    </label>
                                    {aiImagePreview ? (
                                        <div className="relative w-full rounded-xl overflow-hidden border border-gray-200">
                                            <img
                                                src={aiImagePreview}
                                                alt="Yüklenen görsel"
                                                className="w-full max-h-48 object-contain bg-gray-50"
                                            />
                                            <button
                                                onClick={() => { setAiImage(null); setAiImagePreview(null); setAiFileError(""); if (aiFileInputRef.current) aiFileInputRef.current.value = ""; }}
                                                className="absolute top-2 right-2 bg-white border border-gray-300 rounded-full w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 shadow-sm"
                                                aria-label="Görseli kaldır"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); setAiDragOver(true); }}
                                            onDragLeave={() => setAiDragOver(false)}
                                            onDrop={(e) => { e.preventDefault(); setAiDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) applyAIFile(f); }}
                                            onClick={() => aiFileInputRef.current?.click()}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => e.key === "Enter" && aiFileInputRef.current?.click()}
                                            aria-label="Görsel yükleme alanı"
                                            className={`w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors select-none ${aiDragOver ? "border-indigo-500 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"}`}
                                        >
                                            <span className="text-2xl text-gray-300" aria-hidden>📁</span>
                                            <p className="text-sm text-gray-500">
                                                Sürükle bırak veya <span className="text-indigo-600 font-medium">dosya seç</span>
                                            </p>
                                        </div>
                                    )}
                                    <input
                                        ref={aiFileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={(e) => { const f = e.target.files?.[0]; if (f) applyAIFile(f); }}
                                        className="hidden"
                                        aria-hidden
                                    />
                                    {aiFileError && <p className="text-xs text-red-500" role="alert">{aiFileError}</p>}
                                </div>

                                {/* Metin açıklama */}
                                <div className="flex flex-col gap-2">
                                    <label htmlFor="ai-product-desc" className="text-sm font-medium text-gray-700">
                                        Açıklama <span className="text-gray-400 font-normal">(opsiyonel)</span>
                                    </label>
                                    <textarea
                                        id="ai-product-desc"
                                        value={aiDescription}
                                        onChange={(e) => setAiDescription(e.target.value)}
                                        maxLength={1000}
                                        rows={3}
                                        placeholder="Ürün hakkında bilgi verin..."
                                        className="p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                    <p className="text-xs text-gray-400 text-right">{aiDescription.length} / 1000</p>
                                </div>

                                {/* AI Hata */}
                                {aiError && (
                                    <div role="alert" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                                        <p className="font-medium mb-1">AI yanıt vermedi</p>
                                        <p>{aiError}</p>
                                    </div>
                                )}

                                {/* Butonlar */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setShowAIModal(false); resetAIModal(); }}
                                        disabled={aiLoading}
                                        className="flex-1 py-2 px-4 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        onClick={handleAIGenerate}
                                        disabled={(!aiImage && !aiDescription.trim()) || aiLoading}
                                        className="flex-1 py-2 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {aiLoading ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                                                Analiz ediliyor...
                                            </>
                                        ) : (
                                            <>✨ Akıllı Doldur</>
                                        )}
                                    </button>
                                </div>

                                {!aiImage && !aiDescription.trim() && (
                                    <p className="text-xs text-gray-400 text-center -mt-2">
                                        Devam etmek için görsel veya açıklama ekleyin
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Adım 2: Pre-fill'li form */}
                        {aiStep === "form" && (
                            <div className="flex flex-col gap-4">
                                <p className="text-sm text-gray-500">
                                    AI aşağıdaki değerleri önerdi. Düzenleyip kaydedebilirsiniz.
                                </p>
                                <DynamicAddForm
                                    dashboardId={dashboardId}
                                    columns={customColumns}
                                    initialValues={aiPrefillValues}
                                    onSuccess={() => {
                                        setShowAIModal(false);
                                        resetAIModal();
                                        fetchProducts();
                                    }}
                                />
                                <button
                                    onClick={() => setAiStep("input")}
                                    className="text-sm text-gray-500 hover:text-gray-700 underline text-center"
                                >
                                    ← Geri dön (görseli/açıklamayı değiştir)
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
};
