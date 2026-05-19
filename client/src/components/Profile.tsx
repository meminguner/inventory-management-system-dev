import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

interface ProfileData {
    id: number;
    username: string;
    role: string;
}

export const Profile = () => {
    const navigate = useNavigate();
    const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [username, setUsername] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch("/api/profile");
                if (response.status === 401) {
                    navigate("/login");
                    return;
                }
                if (!response.ok) {
                    setError("Profil bilgileri alınamadı.");
                    return;
                }

                const data: ProfileData = await response.json();
                setProfile(data);
                setUsername(data.username);
            } catch {
                setError("Sunucuya bağlanılamadı.");
            }
        };

        fetchProfile();
    }, [navigate]);

    useEffect(() => {
        return () => {
            if (redirectTimeoutRef.current) {
                clearTimeout(redirectTimeoutRef.current);
            }
        };
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (redirectTimeoutRef.current) {
            clearTimeout(redirectTimeoutRef.current);
        }
        setMessage("");
        setError("");

        if (!username.trim()) {
            setError("Kullanıcı adı boş bırakılamaz.");
            return;
        }
        if (!currentPassword) {
            setError("Değişiklikleri kaydetmek için mevcut şifrenizi girin.");
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch("/api/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username.trim(),
                    currentPassword,
                    newPassword,
                }),
            });

            if (response.ok) {
                const data: ProfileData = await response.json();
                setProfile(data);
                setUsername(data.username);
                setCurrentPassword("");
                setNewPassword("");
                setMessage("Profil başarıyla güncellendi. Ana sayfaya yönlendiriliyorsunuz.");
                redirectTimeoutRef.current = setTimeout(() => {
                    navigate("/", { replace: true });
                }, 1200);
            } else {
                const data = await response.json();
                setError(data.error_message || "Profil güncellenemedi.");
            }
        } catch {
            setError("Sunucuya bağlanılamadı.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="container mx-auto px-4 sm:px-8 py-8">
            <div className="mx-auto max-w-md">
                <h2 className="text-2xl font-semibold leading-tight mb-6">Profil Düzenle</h2>

                <form onSubmit={handleSubmit} className="space-y-5 text-left rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium leading-6 text-gray-900">
                            Kullanıcı adı
                        </label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            className="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="role" className="block text-sm font-medium leading-6 text-gray-900">
                            Rol
                        </label>
                        <input
                            id="role"
                            type="text"
                            value={profile?.role || ""}
                            disabled
                            className="block w-full rounded-md border-0 bg-gray-50 px-3 py-2 text-gray-500 shadow-sm ring-1 ring-inset ring-gray-200 sm:text-sm"
                        />
                    </div>

                    <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium leading-6 text-gray-900">
                            Mevcut şifre
                        </label>
                        <input
                            id="currentPassword"
                            type="password"
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            className="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium leading-6 text-gray-900">
                            Yeni şifre
                        </label>
                        <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            className="block w-full rounded-md border-0 px-3 py-2 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
                        />
                    </div>

                    {message && <p className="text-sm text-green-600">{message}</p>}
                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/")}
                            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || Boolean(message)}
                            className="flex-1 rounded-md bg-black px-3 py-2 text-sm font-semibold text-white hover:bg-[#434343] disabled:cursor-not-allowed disabled:bg-gray-400"
                        >
                            {isSaving ? "Kaydediliyor" : message ? "Yönlendiriliyor" : "Kaydet"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
