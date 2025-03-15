import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type File, type User, type FilePermission } from "@shared/schema";
import { Loader2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

interface ShareDialogProps {
  file: File;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareDialog({ file, isOpen, onClose }: ShareDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [username, setUsername] = useState("");

  const { data: permissions = [], isLoading: isLoadingPermissions } = useQuery<FilePermission[]>({
    queryKey: [`/api/files/${file.id}/permissions`],
    enabled: isOpen,
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: isOpen,
  });

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (!isOpen) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "permission_update" && data.fileId === file.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/files/${file.id}/permissions`] });
      }
    };

    return () => ws.close();
  }, [isOpen, file.id, queryClient]);

  const addPermissionMutation = useMutation({
    mutationFn: async (data: {
      userId: number;
      canRead: boolean;
      canWrite: boolean;
      canShare: boolean;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/files/${file.id}/permissions`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/files/${file.id}/permissions`] });
      setUsername("");
      toast({
        title: "Success",
        description: "User permission added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add permission",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePermissionMutation = useMutation({
    mutationFn: async ({
      permissionId,
      data,
    }: {
      permissionId: number;
      data: { canRead: boolean; canWrite: boolean; canShare: boolean };
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/files/${file.id}/permissions/${permissionId}`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/files/${file.id}/permissions`] });
      toast({
        title: "Success",
        description: "Permission updated successfully",
      });
    },
  });

  const removePermissionMutation = useMutation({
    mutationFn: async (permissionId: number) => {
      await apiRequest(
        "DELETE",
        `/api/files/${file.id}/permissions/${permissionId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/files/${file.id}/permissions`] });
      toast({
        title: "Success",
        description: "Permission removed successfully",
      });
    },
  });

  const handleAddPermission = async () => {
    const userToShare = users.find((u) => u.username === username);
    if (!userToShare) {
      toast({
        title: "User not found",
        description: "Please enter a valid username",
        variant: "destructive",
      });
      return;
    }

    if (userToShare.id === currentUser?.id) {
      toast({
        title: "Invalid operation",
        description: "You cannot share with yourself",
        variant: "destructive",
      });
      return;
    }

    addPermissionMutation.mutate({
      userId: userToShare.id,
      canRead: true,
      canWrite: false,
      canShare: false,
    });
  };

  const canManagePermissions =
    currentUser?.isAdmin || file.uploadedBy === currentUser?.id;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share {file.name}</DialogTitle>
        </DialogHeader>

        {/* Add new permission */}
        {canManagePermissions && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Button
                onClick={handleAddPermission}
                disabled={addPermissionMutation.isPending}
              >
                {addPermissionMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Share
              </Button>
            </div>
          </div>
        )}

        {/* Existing permissions */}
        <div className="space-y-4">
          {isLoadingPermissions || isLoadingUsers ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : permissions.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No shared permissions
            </p>
          ) : (
            permissions.map((permission) => {
              const sharedUser = users.find((u) => u.id === permission.userId);
              if (!sharedUser) return null;

              return (
                <div
                  key={permission.id}
                  className="flex items-center justify-between space-x-2 border p-4 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{sharedUser.username}</p>
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={permission.canRead}
                          onCheckedChange={(checked) => {
                            if (canManagePermissions) {
                              updatePermissionMutation.mutate({
                                permissionId: permission.id,
                                data: {
                                  ...permission,
                                  canRead: checked as boolean,
                                },
                              });
                            }
                          }}
                          disabled={!canManagePermissions}
                        />
                        <Label>Read</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={permission.canWrite}
                          onCheckedChange={(checked) => {
                            if (canManagePermissions) {
                              updatePermissionMutation.mutate({
                                permissionId: permission.id,
                                data: {
                                  ...permission,
                                  canWrite: checked as boolean,
                                },
                              });
                            }
                          }}
                          disabled={!canManagePermissions}
                        />
                        <Label>Write</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={permission.canShare}
                          onCheckedChange={(checked) => {
                            if (canManagePermissions) {
                              updatePermissionMutation.mutate({
                                permissionId: permission.id,
                                data: {
                                  ...permission,
                                  canShare: checked as boolean,
                                },
                              });
                            }
                          }}
                          disabled={!canManagePermissions}
                        />
                        <Label>Share</Label>
                      </div>
                    </div>
                  </div>
                  {canManagePermissions && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => removePermissionMutation.mutate(permission.id)}
                      disabled={removePermissionMutation.isPending}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
