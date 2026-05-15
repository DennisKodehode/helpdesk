import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { createUserSchema, updateUserSchema, type CreateUserData, type UpdateUserData, type User } from "@helpdesk/core";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import FieldError from "@/components/ui/FieldError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserDialogProps {
  user?: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserDialog({ user, open, onOpenChange }: UserDialogProps) {
  const isEdit = !!user;
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setError: setFieldError,
    formState: { errors },
  } = useForm<CreateUserData | UpdateUserData>({
    resolver: standardSchemaResolver(isEdit ? updateUserSchema : createUserSchema),
    defaultValues: user
      ? { name: user.name, email: user.email, password: "" }
      : { name: "", email: "", password: "" },
  });

  const saveUserMutation = useMutation({
    mutationFn: (data: CreateUserData | UpdateUserData) =>
      isEdit
        ? axios.patch(`/api/users/${user!.id}`, data)
        : axios.post("/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      if (!isEdit) reset();
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
          <DialogTitle className="display-serif text-2xl leading-tight xl:text-3xl 2xl:text-4xl">
            {isEdit ? "Edit agent" : "New agent"}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => saveUserMutation.mutate(data))}
          noValidate
          className="mt-2 flex flex-col gap-4 xl:gap-5 2xl:gap-6"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Full name"
              aria-invalid={!!errors.name}
              data-invalid={errors.name ? "" : undefined}
              {...register("name")}
            />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="agent@example.com"
              aria-invalid={!!errors.email}
              data-invalid={errors.email ? "" : undefined}
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder={isEdit ? "Leave blank to keep current password" : "Min 8 characters"}
              aria-invalid={!!errors.password}
              data-invalid={errors.password ? "" : undefined}
              {...register("password")}
            />
            <FieldError message={errors.password?.message} />
          </div>
          <DialogFooter className="mt-2">
            <Button type="submit" disabled={saveUserMutation.isPending}>
              {saveUserMutation.isPending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                ? "Save changes"
                : "Create agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
