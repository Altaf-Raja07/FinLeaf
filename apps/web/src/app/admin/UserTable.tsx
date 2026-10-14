"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { updateUserAction } from "./admin-actions";

/**
 * User table with the two administrative actions.
 *
 * The role and status controls are disabled for the signed-in administrator's own
 * row, because self-service here would let one compromised account escalate to
 * permanent and there is no second administrator to undo it. The guard is
 * enforced server-side too, in `updateUser`.
 */

export function UserTable({
  users,
  adminId,
}: {
  users: Array<{
    id: string;
    name: string;
    phone: string;
    village: string;
    status: string;
    role: string;
    trustScore: number;
    greenPoints: number;
    createdAt: string;
  }>;
  adminId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (users.length === 0) {
    return <p className="field-help">No users matched that search.</p>;
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Phone</th>
          <th scope="col">Village</th>
          <th scope="col">Status</th>
          <th scope="col">Role</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <th scope="row" className="font-semibold">
              {user.name}
              <span className="block field-help font-normal">
                {new Date(user.createdAt).toLocaleDateString("en-IN")}
              </span>
            </th>
            <td className="tnum">{user.phone}</td>
            <td>{user.village}</td>
            <td>
              {user.status === "SUSPENDED" ? "Suspended" : user.status === "ACTIVE" ? "Active" : "Pending"}
            </td>
            <td>{user.role === "ADMIN" ? "Administrator" : "User"}</td>
            <td>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || user.id === adminId || user.status === "SUSPENDED"}
                  onClick={() =>
                    startTransition(async () => {
                      await updateUserAction({ userId: user.id, status: "SUSPENDED" });
                      router.refresh();
                    })
                  }
                >
                  Suspend
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || user.id === adminId || user.status === "ACTIVE"}
                  onClick={() =>
                    startTransition(async () => {
                      await updateUserAction({ userId: user.id, status: "ACTIVE" });
                      router.refresh();
                    })
                  }
                >
                  Reactivate
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending || user.id === adminId || user.role === "ADMIN"}
                  onClick={() =>
                    startTransition(async () => {
                      await updateUserAction({ userId: user.id, role: "ADMIN" });
                      router.refresh();
                    })
                  }
                >
                  Make admin
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
