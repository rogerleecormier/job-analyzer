import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listUsers, createUser, deleteUser } from "@/server/functions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AdminUser = {
  id: number;
  email: string;
  role: string;
  createdAt: string;
};

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
    if (context.user.role !== "admin") throw redirect({ to: "/" });
  },
  component: AdminPage,
});

function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  async function fetchUsers() {
    setLoadingUsers(true);
    try {
      setUsers(await listUsers({}));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load users";
      setError(message);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleAddUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await createUser({ data: { email, password } });
      setEmail(""); setPassword("");
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    }
    setLoading(false);
  }

  async function handleDeleteUser(userId: number) {
    if (!window.confirm("Delete this user and all their data?")) return;
    try {
      setError("");
      await deleteUser({ data: { userId } });
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
    }
  }

  return (
    <div className="max-w-xl mx-auto py-12">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      <form onSubmit={handleAddUser} className="flex gap-2 mb-6">
        <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <Button type="submit" disabled={loading}>Add User</Button>
      </form>
      {error && <div className="text-destructive text-sm mb-4">{error}</div>}
      {loadingUsers && <div className="text-sm mb-4">Loading users...</div>}
      <div className="rounded-lg border border-[var(--line)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No users yet
                </TableCell>
              </TableRow>
            ) : (
              users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell>{u.createdAt?.slice(0, 10)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteUser(u.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
