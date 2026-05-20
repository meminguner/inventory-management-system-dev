import { useState } from "react";

export type ColumnType = "metin" | "adet" | "sayı" | "tag";

export interface ColumnConstraints {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    decimalPlaces?: number;
    maxTags?: number;
}

export interface ColumnDefinition {
    name: string;
    type: ColumnType;
    constraints: ColumnConstraints;
}

interface Props {
    initial?: ColumnDefinition;
    existingNames: string[];
    onSubmit: (col: ColumnDefinition) => void;
    onCancel?: () => void;
    submitLabel?: string;
}

const inputClass = "p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full";
const labelClass = "text-xs font-medium text-gray-600 mb-1 block";
const errorClass = "text-xs text-red-500 mt-1";

export const ColumnDefinitionForm = ({
    initial,
    existingNames,
    onSubmit,
    onCancel,
    submitLabel = "Sütun Ekle",
}: Props) => {
    const [name, setName] = useState(initial?.name ?? "");
    const [type, setType] = useState<ColumnType>(initial?.type ?? "metin");
    const [constraints, setConstraints] = useState<ColumnConstraints>(initial?.constraints ?? {});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleTypeChange = (newType: ColumnType) => {
        setType(newType);
        setConstraints({});
        setErrors({});
    };

    const setConstraint = (key: keyof ColumnConstraints, raw: string) => {
        setConstraints(prev => ({
            ...prev,
            [key]: raw === "" ? undefined : Number(raw),
        }));
    };

    const validate = (): boolean => {
        const errs: Record<string, string> = {};

        if (!name.trim()) {
            errs.name = "Sütun ismi zorunludur.";
        } else if (name.trim().length > 30) {
            errs.name = "Sütun ismi en fazla 30 karakter olabilir.";
        } else if (existingNames.map(n => n.toLowerCase()).includes(name.trim().toLowerCase())) {
            errs.name = "Bu isimde bir sütun zaten mevcut.";
        }

        if (type === "metin") {
            const mn = constraints.minLength;
            const mx = constraints.maxLength;
            if (mn !== undefined && mx !== undefined && mn > mx) {
                errs.maxLength = "Maksimum, minimumdan büyük olmalıdır.";
            }
        }

        if (type === "adet" || type === "sayı") {
            const mn = constraints.min;
            const mx = constraints.max;
            if (mn !== undefined && mx !== undefined && mn > mx) {
                errs.max = "Maksimum, minimumdan büyük olmalıdır.";
            }
        }

        if (type === "sayı" && constraints.decimalPlaces !== undefined) {
            if (!Number.isInteger(constraints.decimalPlaces) || constraints.decimalPlaces < 0 || constraints.decimalPlaces > 6) {
                errs.decimalPlaces = "Ondalık basamak 0–6 arasında tam sayı olmalıdır.";
            }
        }

        if (type === "tag" && constraints.maxTags !== undefined) {
            if (!Number.isInteger(constraints.maxTags) || constraints.maxTags < 1) {
                errs.maxTags = "Maksimum etiket sayısı en az 1 olmalıdır.";
            }
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = () => {
        if (!validate()) return;
        onSubmit({ name: name.trim(), type, constraints });
    };

    return (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex flex-col gap-3">
            <div>
                <label htmlFor="col-name" className={labelClass}>Sütun İsmi *</label>
                <input
                    id="col-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Ürün Adı"
                    maxLength={30}
                    className={inputClass}
                    aria-describedby={errors.name ? "col-name-error" : undefined}
                />
                {errors.name && <span id="col-name-error" className={errorClass}>{errors.name}</span>}
            </div>

            <div>
                <label htmlFor="col-type" className={labelClass}>Girdi Tipi *</label>
                <select
                    id="col-type"
                    value={type}
                    onChange={(e) => handleTypeChange(e.target.value as ColumnType)}
                    className={inputClass}
                >
                    <option value="metin">Metin</option>
                    <option value="adet">Adet (tam sayı)</option>
                    <option value="sayı">Sayı (ondalıklı)</option>
                    <option value="tag">Etiket (tag)</option>
                </select>
            </div>

            {type === "metin" && (
                <div className="flex gap-3">
                    <div className="flex-1">
                        <label htmlFor="col-minlen" className={labelClass}>Min. Uzunluk</label>
                        <input
                            id="col-minlen"
                            type="number"
                            min={0}
                            step={1}
                            value={constraints.minLength ?? ""}
                            onChange={(e) => setConstraint("minLength", e.target.value)}
                            placeholder="Opsiyonel"
                            className={inputClass}
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="col-maxlen" className={labelClass}>Max. Uzunluk</label>
                        <input
                            id="col-maxlen"
                            type="number"
                            min={0}
                            step={1}
                            value={constraints.maxLength ?? ""}
                            onChange={(e) => setConstraint("maxLength", e.target.value)}
                            placeholder="Opsiyonel"
                            className={inputClass}
                        />
                        {errors.maxLength && <span className={errorClass}>{errors.maxLength}</span>}
                    </div>
                </div>
            )}

            {(type === "adet" || type === "sayı") && (
                <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-24">
                        <label htmlFor="col-min" className={labelClass}>Min. Değer</label>
                        <input
                            id="col-min"
                            type="number"
                            step={type === "adet" ? 1 : "any"}
                            value={constraints.min ?? ""}
                            onChange={(e) => setConstraint("min", e.target.value)}
                            placeholder="Opsiyonel"
                            className={inputClass}
                        />
                    </div>
                    <div className="flex-1 min-w-24">
                        <label htmlFor="col-max" className={labelClass}>Max. Değer</label>
                        <input
                            id="col-max"
                            type="number"
                            step={type === "adet" ? 1 : "any"}
                            value={constraints.max ?? ""}
                            onChange={(e) => setConstraint("max", e.target.value)}
                            placeholder="Opsiyonel"
                            className={inputClass}
                        />
                        {errors.max && <span className={errorClass}>{errors.max}</span>}
                    </div>
                    {type === "sayı" && (
                        <div className="flex-1 min-w-24">
                            <label htmlFor="col-decimal" className={labelClass}>Ondalık Basamak (0–6)</label>
                            <input
                                id="col-decimal"
                                type="number"
                                min={0}
                                max={6}
                                step={1}
                                value={constraints.decimalPlaces ?? ""}
                                onChange={(e) => setConstraint("decimalPlaces", e.target.value)}
                                placeholder="Varsayılan: 2"
                                className={inputClass}
                            />
                            {errors.decimalPlaces && <span className={errorClass}>{errors.decimalPlaces}</span>}
                        </div>
                    )}
                </div>
            )}

            {type === "tag" && (
                <div>
                    <label htmlFor="col-maxtags" className={labelClass}>
                        Bir ürüne en fazla kaç etiket girilebilir? (boş bırakılırsa sınırsız)
                    </label>
                    <input
                        id="col-maxtags"
                        type="number"
                        min={1}
                        step={1}
                        value={constraints.maxTags ?? ""}
                        onChange={(e) => setConstraint("maxTags", e.target.value)}
                        placeholder="Sınırsız"
                        className={inputClass}
                    />
                    {errors.maxTags && <span className={errorClass}>{errors.maxTags}</span>}
                </div>
            )}

            <div className="flex gap-2 pt-1">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
                    >
                        İptal
                    </button>
                )}
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                    {submitLabel}
                </button>
            </div>
        </div>
    );
};
