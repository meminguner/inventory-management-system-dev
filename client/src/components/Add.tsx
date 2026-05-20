import { useNavigate, useLocation } from "react-router-dom";
import { FormEvent, useState, useEffect, ChangeEvent, KeyboardEvent } from "react";
import Cookies from "js-cookie";

interface ColumnConstraints {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    decimalPlaces?: number;
    maxTags?: number;
}

interface ColumnDefinition {
    name: string;
    type: "metin" | "adet" | "sayı" | "tag";
    constraints: ColumnConstraints;
}

interface Dashboard {
    id: number;
    name: string;
    columnDefinitions: ColumnDefinition[];
}

const inputClass = "block w-full rounded-md border-0 px-2 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6";
const labelClass = "block text-sm font-medium leading-6 text-gray-900";
const errorClass = "text-xs text-red-500 mt-1";

// ── Eski format ürün ekleme (hardcoded sütunlar) ──────────────────────────────

interface ProductData {
    category: string[];
}

const LegacyAddForm = ({ dashboardId, onSuccess }: { dashboardId: number; onSuccess: () => void }) => {
    const [name, setName] = useState("");
    const [price, setPrice] = useState(0);
    const [quantity, setQuantity] = useState(0);
    const [category, setCategory] = useState("");
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch(`/api/products?dashboardId=${dashboardId}`)
            .then(r => r.ok ? r.json() : [])
            .then((products: ProductData[]) => {
                const tags = Array.from(new Set(products.flatMap(p => p.category || [])));
                setAvailableTags(tags);
            })
            .catch(() => {});
    }, [dashboardId]);

    const handleCategoryChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCategory(value);
        const parts = value.split(",");
        const searchStr = parts[parts.length - 1].trim().toLowerCase();
        if (searchStr.length > 0) {
            const currentTags = parts.slice(0, -1).map(p => p.trim().toLowerCase());
            setSuggestions(availableTags.filter(t =>
                t.toLowerCase().startsWith(searchStr) && !currentTags.includes(t.toLowerCase())
            ));
            setActiveSuggestionIndex(0);
        } else {
            setSuggestions([]);
        }
    };

    const acceptSuggestion = (suggestion: string) => {
        const parts = category.split(",");
        parts.pop();
        setCategory((parts.length > 0 ? parts.join(",") + ", " : "") + suggestion + ", ");
        setSuggestions([]);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (suggestions.length === 0) return;
        if (e.key === "ArrowDown") { e.preventDefault(); setActiveSuggestionIndex(p => (p + 1) % suggestions.length); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActiveSuggestionIndex(p => (p - 1 + suggestions.length) % suggestions.length); }
        else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); acceptSuggestion(suggestions[activeSuggestionIndex]); }
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const tags = category.split(",").map(t => t.trim()).filter(t => t !== "");
        if (tags.some(t => t.includes(" "))) {
            setError("Etiketler boşluk içeremez. Kelimeler arası _ kullanın.");
            return;
        }
        const sanitized = Array.from(new Set(tags.map(t => t.toLowerCase())));
        try {
            const res = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dashboardId, name, price, quantity, category: sanitized }),
            });
            if (res.ok) { onSuccess(); } else { setError("Ürün eklenemedi."); }
        } catch { setError("Sunucuya bağlanılamadı."); }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 text-left">
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div>
                <label htmlFor="name" className={labelClass}>Ad</label>
                <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
            </div>
            <div>
                <label htmlFor="price" className={labelClass}>Fiyat</label>
                <input id="price" type="number" value={price} onChange={e => setPrice(Number(e.target.value))} required className={inputClass} />
            </div>
            <div>
                <label htmlFor="quantity" className={labelClass}>Adet</label>
                <input id="quantity" type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} required className={inputClass} />
            </div>
            <div className="relative">
                <label htmlFor="category" className={labelClass}>Kategori</label>
                <input id="category" type="text" value={category} onChange={handleCategoryChange} onKeyDown={handleKeyDown} required autoComplete="off" className={inputClass} />
                {suggestions.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 sm:text-sm">
                        {suggestions.map((s, i) => (
                            <li key={s} onClick={() => acceptSuggestion(s)} className={`cursor-pointer py-2 pl-3 pr-9 ${i === activeSuggestionIndex ? "bg-indigo-600 text-white" : "text-gray-900 hover:bg-gray-100"}`}>{s}</li>
                        ))}
                    </ul>
                )}
            </div>
            <button type="submit" className="flex w-full justify-center rounded-md bg-black px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#434343]">
                Ürün Ekle
            </button>
        </form>
    );
};

// ── Dinamik form (özel sütunlar) ──────────────────────────────────────────────

export const DynamicAddForm = ({
    dashboardId,
    columns,
    onSuccess,
    initialValues,
}: {
    dashboardId: number;
    columns: ColumnDefinition[];
    onSuccess: () => void;
    initialValues?: Record<string, string>;
}) => {
    const [values, setValues] = useState<Record<string, string>>(() => {
        const defaults = Object.fromEntries(columns.map(c => [c.name, ""]));
        return { ...defaults, ...(initialValues ?? {}) };
    });
    const [tagSuggestions, setTagSuggestions] = useState<Record<string, string[]>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitError, setSubmitError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const setValue = (colName: string, val: string) =>
        setValues(prev => ({ ...prev, [colName]: val }));

    const fetchTagSuggestions = async (colName: string, input: string) => {
        const parts = input.split(",");
        const last = parts[parts.length - 1].trim();
        if (last.length < 1) {
            setTagSuggestions(prev => ({ ...prev, [colName]: [] }));
            return;
        }
        try {
            const res = await fetch(
                `/api/tags?dashboardId=${dashboardId}&q=${encodeURIComponent(last)}&column=${encodeURIComponent(colName)}`,
                { headers: { Authorization: `Bearer ${Cookies.get("token")}` } }
            );
            if (res.ok) {
                const data: string[] = await res.json();
                setTagSuggestions(prev => ({ ...prev, [colName]: data || [] }));
            }
        } catch { /* sessiz hata */ }
    };

    const acceptTagSuggestion = (colName: string, suggestion: string) => {
        const parts = (values[colName] || "").split(",");
        parts.pop();
        setValue(colName, (parts.length > 0 ? parts.join(",") + ", " : "") + suggestion + ", ");
        setTagSuggestions(prev => ({ ...prev, [colName]: [] }));
    };

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        for (const col of columns) {
            const raw = (values[col.name] ?? "").trim();
            if (col.type === "tag") {
                const tags = (values[col.name] ?? "").split(",").map(t => t.trim()).filter(t => t !== "");
                if (tags.length === 0) { errs[col.name] = "En az bir etiket giriniz."; continue; }
                if (col.constraints.maxTags !== undefined && tags.length > col.constraints.maxTags) {
                    errs[col.name] = `En fazla ${col.constraints.maxTags} etiket girilebilir.`;
                }
                continue;
            }
            if (!raw) { errs[col.name] = "Bu alan zorunludur."; continue; }
            if (col.type === "metin") {
                if (col.constraints.minLength !== undefined && raw.length < col.constraints.minLength)
                    errs[col.name] = `En az ${col.constraints.minLength} karakter giriniz.`;
                else if (col.constraints.maxLength !== undefined && raw.length > col.constraints.maxLength)
                    errs[col.name] = `En fazla ${col.constraints.maxLength} karakter girilebilir.`;
            } else if (col.type === "adet") {
                const n = parseInt(raw);
                if (isNaN(n) || !Number.isInteger(n)) { errs[col.name] = "Geçerli bir tam sayı giriniz."; }
                else if (col.constraints.min !== undefined && n < col.constraints.min) errs[col.name] = `En az ${col.constraints.min} olmalıdır.`;
                else if (col.constraints.max !== undefined && n > col.constraints.max) errs[col.name] = `En fazla ${col.constraints.max} olabilir.`;
            } else if (col.type === "sayı") {
                const n = parseFloat(raw);
                if (isNaN(n)) { errs[col.name] = "Geçerli bir sayı giriniz."; }
                else if (col.constraints.min !== undefined && n < col.constraints.min) errs[col.name] = `En az ${col.constraints.min} olmalıdır.`;
                else if (col.constraints.max !== undefined && n > col.constraints.max) errs[col.name] = `En fazla ${col.constraints.max} olabilir.`;
            }
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const buildCustomData = (): Record<string, unknown> => {
        const data: Record<string, unknown> = {};
        for (const col of columns) {
            const raw = values[col.name] ?? "";
            if (col.type === "metin") data[col.name] = raw;
            else if (col.type === "adet") data[col.name] = parseInt(raw) || 0;
            else if (col.type === "sayı") data[col.name] = parseFloat(raw) || 0;
            else if (col.type === "tag") data[col.name] = raw.split(",").map(t => t.trim()).filter(t => t !== "");
        }
        return data;
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!validate()) return;
        setIsLoading(true);
        setSubmitError("");
        try {
            const res = await fetch("/api/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dashboardId, customData: buildCustomData() }),
            });
            if (res.ok) { onSuccess(); }
            else {
                const d = await res.json();
                setSubmitError(d.error_message || "Ürün eklenemedi.");
            }
        } catch { setSubmitError("Sunucuya bağlanılamadı."); }
        finally { setIsLoading(false); }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5 text-left">
            {submitError && <p className="text-sm text-red-500">{submitError}</p>}
            {columns.map(col => (
                <div key={col.name}>
                    <label htmlFor={`field-${col.name}`} className={labelClass}>
                        {col.name}
                        <span className="ml-1 text-xs text-gray-400 font-normal">({col.type})</span>
                    </label>

                    {col.type === "metin" && (
                        <input
                            id={`field-${col.name}`}
                            type="text"
                            value={values[col.name] ?? ""}
                            onChange={e => setValue(col.name, e.target.value)}
                            maxLength={col.constraints.maxLength}
                            className={inputClass}
                            placeholder={col.constraints.minLength ? `En az ${col.constraints.minLength} karakter` : ""}
                        />
                    )}

                    {col.type === "adet" && (
                        <input
                            id={`field-${col.name}`}
                            type="number"
                            step="1"
                            min={col.constraints.min}
                            max={col.constraints.max}
                            value={values[col.name] ?? ""}
                            onChange={e => setValue(col.name, e.target.value)}
                            className={inputClass}
                        />
                    )}

                    {col.type === "sayı" && (
                        <input
                            id={`field-${col.name}`}
                            type="number"
                            step={col.constraints.decimalPlaces !== undefined ? Math.pow(10, -col.constraints.decimalPlaces) : "any"}
                            min={col.constraints.min}
                            max={col.constraints.max}
                            value={values[col.name] ?? ""}
                            onChange={e => setValue(col.name, e.target.value)}
                            className={inputClass}
                        />
                    )}

                    {col.type === "tag" && (
                        <div className="relative">
                            <input
                                id={`field-${col.name}`}
                                type="text"
                                value={values[col.name] ?? ""}
                                onChange={e => {
                                    setValue(col.name, e.target.value);
                                    fetchTagSuggestions(col.name, e.target.value);
                                }}
                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                    const sugs = tagSuggestions[col.name] ?? [];
                                    if (e.key === "Enter" && sugs.length > 0) {
                                        e.preventDefault();
                                        acceptTagSuggestion(col.name, sugs[0]);
                                    }
                                }}
                                autoComplete="off"
                                className={inputClass}
                                placeholder="virgülle ayırın: elektronik, ses"
                            />
                            {(tagSuggestions[col.name] ?? []).length > 0 && (
                                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5">
                                    {(tagSuggestions[col.name] ?? []).map(s => (
                                        <li
                                            key={s}
                                            onClick={() => acceptTagSuggestion(col.name, s)}
                                            className="cursor-pointer py-2 pl-3 pr-4 text-gray-900 hover:bg-indigo-50"
                                        >{s}</li>
                                    ))}
                                </ul>
                            )}
                            {col.constraints.maxTags && (
                                <p className="text-xs text-gray-400 mt-1">En fazla {col.constraints.maxTags} etiket</p>
                            )}
                        </div>
                    )}

                    {errors[col.name] && <p className={errorClass}>{errors[col.name]}</p>}
                </div>
            ))}
            <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center rounded-md bg-black px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#434343] disabled:opacity-50"
            >
                {isLoading ? "Ekleniyor..." : "Ürün Ekle"}
            </button>
        </form>
    );
};

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export const Add = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const dashboardId = parseInt(searchParams.get("dashboardId") || "0", 10);

    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!dashboardId) { navigate("/"); return; }
        fetch(`/api/dashboards/${dashboardId}`, {
            headers: { Authorization: `Bearer ${Cookies.get("token")}` },
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => { setDashboard(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [dashboardId, navigate]);

    const handleSuccess = () => {
        navigate(`/dashboard?id=${dashboardId}&name=${encodeURIComponent(dashboard?.name ?? "")}`);
    };

    const hasCustomColumns = (dashboard?.columnDefinitions?.length ?? 0) > 0;

    return (
        <div className="flex items-center justify-center min-h-[70vh]">
            <div className="flex min-h-full flex-1 flex-col justify-center items-center px-6 py-12 lg:px-8">
                <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
                    <h2 className="text-2xl mb-2 font-semibold leading-tight">Ürün Ekle</h2>
                    {dashboard && (
                        <p className="text-sm text-gray-500 mb-8">
                            Tablo: <span className="font-medium text-gray-700">{dashboard.name}</span>
                        </p>
                    )}

                    {loading && (
                        <p className="text-sm text-gray-400">Yükleniyor...</p>
                    )}

                    {!loading && hasCustomColumns && (
                        <DynamicAddForm
                            dashboardId={dashboardId}
                            columns={dashboard!.columnDefinitions}
                            onSuccess={handleSuccess}
                        />
                    )}

                    {!loading && !hasCustomColumns && (
                        <LegacyAddForm dashboardId={dashboardId} onSuccess={handleSuccess} />
                    )}
                </div>
            </div>
        </div>
    );
};
