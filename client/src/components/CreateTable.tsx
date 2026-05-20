import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { ColumnDefinitionForm, ColumnDefinition } from "./ColumnDefinitionForm";

const constraintSummary = (col: ColumnDefinition): string => {
    const c = col.constraints;
    switch (col.type) {
        case "metin": {
            const parts: string[] = [];
            if (c.minLength !== undefined) parts.push(`min: ${c.minLength}`);
            if (c.maxLength !== undefined) parts.push(`max: ${c.maxLength}`);
            return parts.length > 0 ? parts.join(", ") : "sınırsız";
        }
        case "adet":
        case "sayı": {
            const parts: string[] = [];
            if (c.min !== undefined) parts.push(`min: ${c.min}`);
            if (c.max !== undefined) parts.push(`max: ${c.max}`);
            if (col.type === "sayı" && c.decimalPlaces !== undefined) parts.push(`ondalık: ${c.decimalPlaces}`);
            return parts.length > 0 ? parts.join(", ") : "sınırsız";
        }
        case "tag":
            return c.maxTags !== undefined ? `max: ${c.maxTags} etiket` : "sınırsız";
    }
};

const TYPE_LABELS: Record<string, string> = {
    metin: "Metin",
    adet: "Adet",
    "sayı": "Sayı",
    tag: "Etiket",
};

export const CreateTable = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState<1 | 2>(1);
    const [tableName, setTableName] = useState("");
    const [tableNameError, setTableNameError] = useState("");
    const [columns, setColumns] = useState<ColumnDefinition[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [serverError, setServerError] = useState("");

    const goToStep2 = () => {
        const trimmed = tableName.trim();
        if (!trimmed) {
            setTableNameError("Tablo ismi zorunludur.");
            return;
        }
        if (trimmed.length > 50) {
            setTableNameError("Tablo ismi en fazla 50 karakter olabilir.");
            return;
        }
        setTableNameError("");
        setServerError("");
        setStep(2);
    };

    const handleColumnSubmit = (col: ColumnDefinition) => {
        if (editingIndex !== null) {
            setColumns(prev => prev.map((c, i) => (i === editingIndex ? col : c)));
            setEditingIndex(null);
        } else {
            setColumns(prev => [...prev, col]);
        }
    };

    const handleDeleteColumn = (index: number) => {
        setColumns(prev => prev.filter((_, i) => i !== index));
        if (editingIndex === index) setEditingIndex(null);
    };

    const handleCreate = async () => {
        if (columns.length === 0 || isLoading) return;

        setIsLoading(true);
        setServerError("");

        try {
            const res = await fetch("/api/dashboards", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${Cookies.get("token")}`,
                },
                body: JSON.stringify({
                    name: tableName.trim(),
                    columnDefinitions: columns,
                }),
            });

            if (res.ok) {
                const dashboard = await res.json();
                navigate(
                    `/dashboard?id=${dashboard.id}&name=${encodeURIComponent(dashboard.name)}`,
                    { state: { columnDefinitions: columns } }
                );
            } else {
                const data = await res.json();
                const msg = data.error_message || "Tablo oluşturulurken bir hata oluştu.";
                setServerError(msg);
                if (msg.toLowerCase().includes("isim") || msg.toLowerCase().includes("tablo")) {
                    setStep(1);
                }
            }
        } catch {
            setServerError("Sunucuya bağlanılamadı.");
        } finally {
            setIsLoading(false);
        }
    };

    const existingNamesForForm = columns
        .filter((_, i) => i !== editingIndex)
        .map(c => c.name);

    return (
        <div className="w-full flex-1 flex flex-col items-center justify-start p-6 sm:p-8 mt-8">
            <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col gap-6">

                {/* Adım göstergesi */}
                <div className="flex items-center gap-2">
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${step >= 1 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}
                        aria-current={step === 1 ? "step" : undefined}
                    >1</div>
                    <div className={`flex-1 h-1 rounded transition-colors ${step >= 2 ? "bg-indigo-600" : "bg-gray-200"}`} />
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${step >= 2 ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}
                        aria-current={step === 2 ? "step" : undefined}
                    >2</div>
                </div>

                {/* ── Adım 1: Tablo İsmi ── */}
                {step === 1 && (
                    <>
                        <div>
                            <h2 className="text-2xl font-semibold">Yeni Tablo Oluştur</h2>
                            <p className="text-sm text-gray-500 mt-1">Adım 1 / 2 — Tablo İsmi</p>
                        </div>

                        {serverError && (
                            <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                                {serverError}
                            </div>
                        )}

                        <div className="flex flex-col gap-1">
                            <label htmlFor="tableName" className="text-sm font-medium text-gray-700">
                                Tablo İsmi *
                            </label>
                            <input
                                id="tableName"
                                type="text"
                                value={tableName}
                                onChange={(e) => setTableName(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && goToStep2()}
                                placeholder="Örn: Elektronik Eşyalar"
                                maxLength={50}
                                autoFocus
                                className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                aria-describedby={tableNameError ? "tableName-error" : undefined}
                            />
                            {tableNameError && (
                                <span id="tableName-error" className="text-xs text-red-500">{tableNameError}</span>
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => navigate("/")}
                                className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={goToStep2}
                                className="flex-1 py-3 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                            >
                                İleri
                            </button>
                        </div>
                    </>
                )}

                {/* ── Adım 2: Sütun Tanımlama ── */}
                {step === 2 && (
                    <>
                        <div>
                            <h2 className="text-2xl font-semibold">Sütun Tanımlama</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Adım 2 / 2 —{" "}
                                <span className="font-medium text-gray-700">{tableName}</span>{" "}
                                tablosu için sütunları ekleyin
                            </p>
                        </div>

                        {serverError && (
                            <div role="alert" className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                                {serverError}
                            </div>
                        )}

                        {/* Eklenen sütunlar listesi */}
                        {columns.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <p className="text-sm font-medium text-gray-700">
                                    Eklenen Sütunlar ({columns.length})
                                </p>
                                {columns.map((col, i) => (
                                    <div
                                        key={i}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                            editingIndex === i
                                                ? "border-indigo-400 bg-indigo-50"
                                                : "border-gray-200 bg-white"
                                        }`}
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">{col.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {TYPE_LABELS[col.type] ?? col.type} — {constraintSummary(col)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 shrink-0">
                                            <button
                                                onClick={() => setEditingIndex(i)}
                                                aria-label={`${col.name} sütununu düzenle`}
                                                className="text-xs px-3 py-1 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors"
                                            >
                                                Düzenle
                                            </button>
                                            <button
                                                onClick={() => handleDeleteColumn(i)}
                                                aria-label={`${col.name} sütununu sil`}
                                                className="text-xs px-3 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                                            >
                                                Sil
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Sütun formu */}
                        <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">
                                {editingIndex !== null ? "Sütunu Düzenle" : "Yeni Sütun Ekle"}
                            </p>
                            <ColumnDefinitionForm
                                key={editingIndex !== null ? `edit-${editingIndex}` : `new-${columns.length}`}
                                initial={editingIndex !== null ? columns[editingIndex] : undefined}
                                existingNames={existingNamesForForm}
                                onSubmit={handleColumnSubmit}
                                onCancel={editingIndex !== null ? () => setEditingIndex(null) : undefined}
                                submitLabel={editingIndex !== null ? "Güncelle" : "Sütun Ekle"}
                            />
                        </div>

                        {/* Navigasyon */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => { setStep(1); setServerError(""); }}
                                disabled={isLoading}
                                className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                Geri
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={columns.length === 0 || isLoading}
                                className="flex-1 py-3 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-describedby={columns.length === 0 ? "create-hint" : undefined}
                            >
                                {isLoading ? "Oluşturuluyor..." : "Tabloyu Oluştur"}
                            </button>
                        </div>
                        {columns.length === 0 && (
                            <p id="create-hint" className="text-xs text-gray-400 text-center -mt-4">
                                En az 1 sütun ekleyin
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
