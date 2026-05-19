import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { RiDeleteBin6Line } from "react-icons/ri";

interface User {
    id: number;
    username: string;
    role: string;
}

interface Dashboard {
    id: number;
    name: string;
}

export const UserManagement = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [dashboards, setDashboards] = useState<Dashboard[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string>("");
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userDashboards, setUserDashboards] = useState<number[]>([]);

    const parseJwt = (token: string) => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch {
            return null;
        }
    };

    useEffect(() => {
        const token = Cookies.get("token");
        if (!token) {
            navigate("/login");
            return;
        }
        const decoded = parseJwt(token);
        if (decoded && decoded.role) {
            setCurrentUserRole(decoded.role);
            if (decoded.role !== "admin" && decoded.role !== "super_user") {
                navigate("/");
                return;
            }
        }
        
        fetchUsers(token);
        fetchDashboards(token);
    }, [navigate]);

    const fetchUsers = async (token: string) => {
        try {
            const response = await fetch("/api/users", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data || []);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const fetchDashboards = async (token: string) => {
        try {
            const response = await fetch("/api/dashboards", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setDashboards(data || []);
            }
        } catch (error) {
            console.error("Error fetching dashboards:", error);
        }
    };

    const handleRoleChange = async (userId: number, newRole: string, username: string) => {
        const token = Cookies.get("token");
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ username, role: newRole })
            });
            if (response.ok) {
                setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            } else {
                alert("Failed to update user role");
            }
        } catch (error) {
            console.error("Error updating role:", error);
        }
    };

    const handleDelete = async (userId: number) => {
        if (!window.confirm("Are you sure you want to delete this user?")) return;
        const token = Cookies.get("token");
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                setUsers(users.filter(u => u.id !== userId));
            } else {
                const error = await response.json();
                alert(`Failed to delete user: ${error.error_message || "Unknown error"}`);
            }
        } catch (error) {
            console.error("Error deleting user:", error);
        }
    };

    const openPermissionsModal = async (user: User) => {
        setSelectedUser(user);
        const token = Cookies.get("token");
        try {
            const response = await fetch(`/api/users/${user.id}/dashboards`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUserDashboards(data.dashboard_ids || []);
                setIsModalOpen(true);
            }
        } catch (error) {
            console.error("Error fetching user dashboards:", error);
        }
    };

    const toggleDashboardPermission = (dashboardId: number) => {
        setUserDashboards(prev => 
            prev.includes(dashboardId) 
                ? prev.filter(id => id !== dashboardId)
                : [...prev, dashboardId]
        );
    };

    const savePermissions = async () => {
        if (!selectedUser) return;
        const token = Cookies.get("token");
        try {
            const response = await fetch(`/api/users/${selectedUser.id}/dashboards`, {
                method: "PUT",
                headers: { 
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ dashboard_ids: userDashboards })
            });
            if (response.ok) {
                setIsModalOpen(false);
            } else {
                alert("Failed to update permissions");
            }
        } catch (error) {
            console.error("Error updating permissions:", error);
        }
    };

    return (
        <div className="container mx-auto px-4 sm:px-8 py-8">
            <h2 className="text-2xl font-semibold leading-tight mb-6">Kullanıcı Yönetimi</h2>
            
            <div className="overflow-x-auto shadow-md rounded-lg">
                <table className="min-w-full leading-normal bg-white">
                    <thead>
                        <tr>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ID</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Username</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                            <th className="px-5 py-3 border-b-2 border-gray-200 bg-gray-100 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users
                            .filter(user => currentUserRole === "admin" || user.role === "user")
                            .map(user => (
                            <tr key={user.id}>
                                <td className="px-5 py-5 border-b border-gray-200 text-sm">
                                    <p className="text-gray-900 whitespace-no-wrap">{user.id}</p>
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 text-sm">
                                    <p className="text-gray-900 whitespace-no-wrap">{user.username}</p>
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 text-sm">
                                    {currentUserRole === "admin" && user.role !== "admin" ? (
                                        <select 
                                            value={user.role} 
                                            onChange={(e) => handleRoleChange(user.id, e.target.value, user.username)}
                                            className="block bg-white border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                        >
                                            <option value="user">User</option>
                                            <option value="super_user">Super User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    ) : (
                                        <p className="text-gray-900 whitespace-no-wrap">{user.role}</p>
                                    )}
                                </td>
                                <td className="px-5 py-5 border-b border-gray-200 text-sm">
                                    <div className="flex items-center gap-4">
                                        {user.role === "user" && (
                                            <button 
                                                onClick={() => openPermissionsModal(user)}
                                                className="text-indigo-600 hover:text-indigo-900 font-medium"
                                            >
                                                Manage Access
                                            </button>
                                        )}
                                        {currentUserRole === "admin" && user.role !== "admin" && (
                                            <button 
                                                onClick={() => handleDelete(user.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <RiDeleteBin6Line size={18} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && selectedUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setIsModalOpen(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    Manage Dashboard Access for {selectedUser.username}
                                </h3>
                                <div className="mt-4 max-h-60 overflow-y-auto">
                                    {dashboards.map(dashboard => (
                                        <div key={dashboard.id} className="flex items-center mb-2">
                                            <input 
                                                id={`dash-${dashboard.id}`} 
                                                type="checkbox" 
                                                checked={userDashboards.includes(dashboard.id)}
                                                onChange={() => toggleDashboardPermission(dashboard.id)}
                                                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                            <label htmlFor={`dash-${dashboard.id}`} className="ml-2 text-sm font-medium text-gray-900">
                                                {dashboard.name}
                                            </label>
                                        </div>
                                    ))}
                                    {dashboards.length === 0 && (
                                        <p className="text-sm text-gray-500">No dashboards available.</p>
                                    )}
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button 
                                    type="button" 
                                    onClick={savePermissions}
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Save
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
