import {
    TABLE_CREATION_PRE_PROMPT,
    TABLE_CREATION_POST_PROMPT,
    PRODUCT_ADD_PRE_PROMPT,
    PRODUCT_ADD_POST_PROMPT,
} from "../config/ai-prompts";

// ─── Tipler ──────────────────────────────────────────────────────────────────

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

export interface TableSchemaResponse {
    columns: ColumnDefinition[];
}

export interface ProductFieldsResponse {
    fields: Record<string, string | number | string[] | null>;
}

// ─── Env okuma ───────────────────────────────────────────────────────────────

const AI_PROVIDER = (import.meta.env.VITE_AI_API_PROVIDER as string) || "openai";
const AI_MODEL = (import.meta.env.VITE_AI_MODEL as string) || "gpt-4o";

// API anahtarı frontend'de tutulmaz — istekler backend'in /ai/chat
// proxy'sine gider, anahtar sunucu tarafında eklenir.
const AI_PROXY_URL = "/api/ai/chat";

const REQUEST_TIMEOUT_MS = 60_000;

// ─── Yardımcı: dosyayı base64'e çevir ───────────────────────────────────────

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ─── Yardımcı: ham JSON metnini parse et ─────────────────────────────────────

function parseAIJson(raw: string): unknown {
    const trimmed = raw.trim();
    // Bazı modeller ```json ... ``` bloğu döndürebilir — strip et
    const stripped = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(stripped);
}

// ─── Yardımcı: AbortController ile timeout ───────────────────────────────────

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...init, signal: controller.signal }).finally(() =>
        clearTimeout(timer)
    );
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(
    systemPrompt: string,
    userText: string,
    image?: File
): Promise<string> {
    const userContent: unknown[] = [{ type: "text", text: userText }];

    if (image) {
        const b64 = await fileToBase64(image);
        userContent.push({
            type: "image_url",
            image_url: { url: `data:${image.type};base64,${b64}`, detail: "low" },
        });
    }

    const body = {
        model: AI_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 1024,
    };

    const res = await fetchWithTimeout(
        AI_PROXY_URL,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
        REQUEST_TIMEOUT_MS
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
            (err as { error?: { message?: string } }).error?.message ||
            (err as { error_message?: string }).error_message ||
            `OpenAI API hatası: ${res.status}`
        );
    }

    const data = await res.json() as {
        choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0].message.content;
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function callAnthropic(
    systemPrompt: string,
    userText: string,
    image?: File
): Promise<string> {
    const userContent: unknown[] = [];

    if (image) {
        const b64 = await fileToBase64(image);
        const mediaType = image.type as "image/jpeg" | "image/png" | "image/webp";
        userContent.push({
            type: "image",
            source: { type: "base64", media_type: mediaType, data: b64 },
        });
    }

    userContent.push({ type: "text", text: userText });

    const body = {
        model: AI_MODEL,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.2,
        max_tokens: 1024,
    };

    const res = await fetchWithTimeout(
        AI_PROXY_URL,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        },
        REQUEST_TIMEOUT_MS
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
            (err as { error?: { message?: string } }).error?.message ||
            (err as { error_message?: string }).error_message ||
            `Anthropic API hatası: ${res.status}`
        );
    }

    const data = await res.json() as {
        content: Array<{ type: string; text: string }>;
    };
    return data.content.find((b) => b.type === "text")?.text ?? "";
}

// ─── Provider dispatch ────────────────────────────────────────────────────────

async function callAI(
    systemPrompt: string,
    userText: string,
    image?: File
): Promise<string> {
    switch (AI_PROVIDER) {
        case "anthropic":
            return callAnthropic(systemPrompt, userText, image);
        case "openai":
        default:
            return callOpenAI(systemPrompt, userText, image);
    }
}

// ─── Public API: Tablo şeması üret ───────────────────────────────────────────

export async function generateTableSchema(input: {
    tableName: string;
    description?: string;
    image?: File;
}): Promise<TableSchemaResponse> {
    const { tableName, description, image } = input;

    const userText = [
        TABLE_CREATION_PRE_PROMPT,
        "",
        `Tablo ismi: "${tableName}"`,
        "",
        "Kullanıcı açıklaması:",
        `"""`,
        description?.trim() || "yok",
        `"""`,
        "",
        TABLE_CREATION_POST_PROMPT,
    ].join("\n");

    const raw = await callAI("", userText, image);

    let parsed: unknown;
    try {
        parsed = parseAIJson(raw);
    } catch {
        throw new Error("AI cevabı okunamadı, lütfen tekrar deneyin.");
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.error === "string") {
        throw new Error(obj.error);
    }

    if (!Array.isArray(obj.columns)) {
        throw new Error("AI cevabı okunamadı, lütfen tekrar deneyin.");
    }

    const validTypes = new Set<string>(["metin", "adet", "sayı", "tag"]);
    const columns: ColumnDefinition[] = (obj.columns as unknown[]).filter(
        (c): c is ColumnDefinition =>
            typeof (c as ColumnDefinition).name === "string" &&
            validTypes.has((c as ColumnDefinition).type)
    );

    if (columns.length === 0) {
        throw new Error("AI geçerli sütun önerisi üretemedi. Lütfen açıklamanızı detaylandırın.");
    }

    return { columns };
}

// ─── Public API: Ürün alanları üret (Görev 3) ────────────────────────────────

export async function generateProductFields(input: {
    description?: string;
    image?: File;
    tableSchema: ColumnDefinition[];
    existingTags?: Record<string, string[]>;
}): Promise<ProductFieldsResponse> {
    const { description, image, tableSchema, existingTags } = input;

    const userText = [
        PRODUCT_ADD_PRE_PROMPT,
        "",
        `Tablo şeması: ${JSON.stringify(tableSchema, null, 2)}`,
        "",
        existingTags && Object.keys(existingTags).length > 0
            ? `Mevcut etiket havuzu: ${JSON.stringify(existingTags, null, 2)}`
            : "",
        "",
        "Kullanıcı açıklaması:",
        `"""`,
        description?.trim() || "yok",
        `"""`,
        "",
        PRODUCT_ADD_POST_PROMPT,
    ]
        .filter((l) => l !== "")
        .join("\n");

    const raw = await callAI("", userText, image);

    let parsed: unknown;
    try {
        parsed = parseAIJson(raw);
    } catch {
        throw new Error("AI cevabı okunamadı, lütfen tekrar deneyin.");
    }

    const obj = parsed as Record<string, unknown>;

    if (typeof obj.error === "string") {
        throw new Error(obj.error);
    }

    if (typeof obj.fields !== "object" || obj.fields === null) {
        throw new Error("AI cevabı okunamadı, lütfen tekrar deneyin.");
    }

    return { fields: obj.fields as ProductFieldsResponse["fields"] };
}
