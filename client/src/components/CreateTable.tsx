import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";

export const CreateTable = () => {
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleCreate = async () => {
        if (!name.trim()) {
            setError("Lütfen bir tablo ismi giriniz.");
            return;
        }

        try {
            const response = await fetch("/api/dashboards", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${Cookies.get("token")}`,
                },
                body: JSON.stringify({ name }),
            });

            if (response.ok) {
                navigate("/");
            } else {
                const data = await response.json();
                setError(data.message || "Tablo oluşturulurken bir hata oluştu.");
            }
        } catch {
            setError("Sunucuya bağlanılamadı.");
        }
    };

    const handleCancel = () => {
        navigate("/");
    };

    return (
        <div className="w-full flex-1 flex flex-col items-center justify-center p-8 mt-10">
            <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex flex-col gap-6">
                <h2 className="text-2xl font-semibold">Yeni Tablo Oluştur</h2>
                
                {error && (
                    <div className="p-3 rounded bg-red-50 text-red-600 text-sm">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <label htmlFor="tableName" className="text-sm font-medium text-gray-700">Tablo İsmi</label>
                    <input
                        id="tableName"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Örn: Elektronik Eşyalar"
                        className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex gap-4 mt-4">
                    <button
                        onClick={handleCancel}
                        className="flex-1 py-3 px-4 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleCreate}
                        className="flex-1 py-3 px-4 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                    >
                        Oluştur
                    </button>
                </div>
            </div>
        </div>
    );
};
