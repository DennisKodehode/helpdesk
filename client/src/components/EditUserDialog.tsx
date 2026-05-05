import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { updateUserSchema, type UpdateUserData, type User } from "@helpdesk/core";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditUserDialog({ user, open, onOpenChange }: EditUserDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors },
  } = useForm<UpdateUserData>({
    resolver: standardSchemaResolver(updateUserSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    if (user) reset({ name: user.name, email: user.email, password: "" });
  }, [user, reset]);

  const mutation = useMutation({
    mutationFn: (data: UpdateUserData) => axios.patch(`/api/users/${user!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (axios.isAxiosError(err)) {
        setFieldError("email", { message: err.response?.data?.error ?? "Something went wrong" });
      }
    },
  });

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) reset({ name: "", email: "", password: "" });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Agent</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          noValidate
          className="flex flex-col gap-4 mt-2"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              placeholder="Full name"
              aria-invalid={!!errors.name}
              data-invalid={errors.name ? "" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="agent@example.com"
              aria-invalid={!!errors.email}
              data-invalid={errors.email ? "" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-password">Password</Label>
            <Input
              id="edit-password"
              type="password"
              placeholder="Leave blank to keep current password"
              aria-invalid={!!errors.password}
              data-invalid={errors.password ? "" : undefined}
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
