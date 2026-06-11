import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { generateTableSchema } from "../lib/ai-client";
import type { ColumnDefinition } from "../lib/ai-client";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DESC_CHARS = 1000;

export const CreateTableAI = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const tableName: string = (location.state as { tableName?: string })?.tableName ?? "";

    const [image, setImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [description, setDescription] = useState("");
    const [dragOver, setDragOver] = useState(false);
    const [fileError, setFileError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [aiError, setAiError] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Tablo ismi olmadan bu sayfaya gelinmişse wizard'a geri yönlendir
    useEffect(() => {
        if (!tableName) navigate("/create-table", { replace: true });
    }, [tableName, navigate]);

    const hasInput = image !== null || description.trim().length > 0;

    const applyFile = (file: File) => {
        setFileError("");
        if (!ACCEPTED_TYPES.includes(file.type)) {
            setFileError("Sadece JPG, PNG veya WebP dosyası yükleyebilirsiniz.");
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            setFileError("Dosya boyutu 10 MB'ı aşamaz.");
            return;
        }
        // Bozuk dosyayı AI'a göndermeden yakala: tarayıcıda decode edilemeyen görsel reddedilir
        const url = URL.createObjectURL(file);
        const probe = new Image();
        probe.onload = () => {
            setImage(file);
            setImagePreview(url);
        };
        probe.onerror = () => {
            URL.revokeObjectURL(url);
            setFileError("Görsel okunamadı — dosya bozuk olabilir. Başka bir görsel deneyin.");
        };
        probe.src = url;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) applyFile(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) applyFile(file);
    };

    const removeImage = () => {
        setImage(null);
        setImagePreview(null);
        setFileError("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleGenerate = async () => {
        if (!hasInput || isLoading) return;
        setIsLoading(true);
        setAiError("");
        try {
            const result = await generateTableSchema({
                tableName,
                description: description.trim() || undefined,
                image: image ?? undefined,
            });
            const columns: ColumnDefinition[] = result.columns;
            // Wizard Step 2'ye sütunlarla birlikte dön
            navigate("/create-table", {
                state: { step: 2, tableName, aiColumns: columns },
            });
        } catch (err: unknown) {
            setAiError(
                err instanceof Error
                    ? err.message
                    : "Beklenmedik bir hata oluştu, lütfen tekrar deneyin."
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = () => {
        navigate("/create-table", {
            state: { step: 2, tableName, aiColumns: [] },
        });
    };

    return (
        <div className="w-full flex-1 flex flex-col items-center justify-start p-6 sm:p-8 mt-8">
            <div className="w-full max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex flex-col gap-6">

                {/* Başlık */}
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl" aria-hidden>✨</span>
                        <h2 className="text-2xl font-semibold">AI ile Tablo Oluştur</h2>
                    </div>
                    <p className="text-sm text-gray-500">
                        Tablo: <span className="font-medium text-gray-700">{tableName}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                        Görsel ve/veya açıklama girin — AI tablosu için uygun sütunları önerecek.
                        En az biri zorunludur.
                    </p>
                </div>

                {/* Görsel yükleme */}
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">
                        Görsel <span className="text-gray-400 font-normal">(opsiyonel — JPG, PNG, WebP, maks. 10 MB)</span>
                    </label>

                    {imagePreview ? (
                        <div className="relative w-full rounded-xl overflow-hidden border border-gray-200">
                            <img
                                src={imagePreview}
                                alt="Yüklenen görsel"
                                className="w-full max-h-64 object-contain bg-gray-50"
                            />
                            <button
                                onClick={removeImage}
                                className="absolute top-2 right-2 bg-white border border-gray-300 rounded-full w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors shadow-sm"
                                aria-label="Görseli kaldır"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                            aria-label="Görsel yükleme alanı"
                            className={`w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors select-none
                                ${dragOver
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
                                }`}
                        >
                            <span className="text-3xl text-gray-300" aria-hidden>📁</span>
                            <p className="text-sm text-gray-500">
                                Sürükle bırak veya{" "}
                                <span className="text-indigo-600 font-medium">dosya seç</span>
                            </p>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_TYPES.join(",")}
                        onChange={handleFileChange}
                        className="hidden"
                        aria-hidden
                    />

                    {fileError && (
                        <p className="text-xs text-red-500" role="alert">{fileError}</p>
                    )}
                </div>

                {/* Açıklama */}
                <div className="flex flex-col gap-2">
                    <label htmlFor="ai-description" className="text-sm font-medium text-gray-700">
                        Açıklama <span className="text-gray-400 font-normal">(opsiyonel)</span>
                    </label>
                    <textarea
                        id="ai-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={MAX_DESC_CHARS}
                        rows={4}
                        placeholder={`Örn: Elektronik ürün envanteri. Laptopları, tabletleri ve aksesuarları takip edeceğim. Fiyat, stok ve garanti bilgisi önemli.`}
                        className="p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <p className="text-xs text-gray-400 text-right">
                        {description.length} / {MAX_DESC_CHARS}
                    </p>
                </div>

                {/* AI Hata */}
                {aiError && (
                    <div role="alert" className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                        <p className="font-medium mb-1">AI yanıt vermedi</p>
                        <p>{aiError}</p>
                    </div>
                )}

                {/* Butonlar */}
                <div className="flex gap-4">
                    <button
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={!hasInput || isLoading}
                        className="flex-1 py-3 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span
                                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                                    aria-hidden
                                />
                                Analiz ediliyor...
                            </>
                        ) : (
                            <>✨ Akıllı Oluştur</>
                        )}
                    </button>
                </div>

                {!hasInput && (
                    <p className="text-xs text-gray-400 text-center -mt-4">
                        Devam etmek için görsel veya açıklama ekleyin
                    </p>
                )}
            </div>
        </div>
    );
};
