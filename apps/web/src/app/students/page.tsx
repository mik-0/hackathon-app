"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc, queryClient } from "@/utils/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import Loader from "@/components/loader";

/**
 * 🎓 COMPLETE STUDENT MANAGEMENT EXAMPLE
 *
 * This demonstrates ALL tRPC/React Query patterns:
 * ✅ Queries with loading/error states
 * ✅ Mutations with optimistic updates
 * ✅ Cache invalidation
 * ✅ Form handling
 * ✅ Search functionality
 * ✅ CRUD operations
 */
export default function StudentsPage() {
	// 📝 Form state
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [studentNumber, setStudentNumber] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);

	// 📖 READ: Get all students
	const {
		data: students,
		isLoading,
		error,
	} = useQuery(trpc.students.getAll.queryOptions());

	// 🔍 SEARCH: Search students (only when query exists)
	const { data: searchResults } = useQuery({
		...trpc.students.search.queryOptions({ query: searchQuery }),
		enabled: searchQuery.length > 0, // Only search when there's a query
	});

	// ✍️ CREATE: Add new student
	const createStudent = useMutation({
		...trpc.students.create.mutationOptions(),
		onSuccess: (data) => {
			toast.success(`Student ${data.name} created! 🎉`);
			// Invalidate to refetch the list
			queryClient.invalidateQueries({
				queryKey: [["students", "getAll"]],
			});
			// Clear form
			setName("");
			setEmail("");
			setStudentNumber("");
		},
		onError: (error) => {
			toast.error(`Failed to create: ${error.message}`);
		},
	});

	// 🔄 UPDATE: Edit student
	const updateStudent = useMutation({
		...trpc.students.update.mutationOptions(),
		onSuccess: (data) => {
			toast.success(`Student updated! ✨`);
			queryClient.invalidateQueries({
				queryKey: [["students", "getAll"]],
			});
			setEditingId(null);
			setName("");
			setEmail("");
		},
		onError: (error) => {
			toast.error(`Failed to update: ${error.message}`);
		},
	});

	// 🗑️ DELETE: Remove student
	const deleteStudent = useMutation({
		...trpc.students.delete.mutationOptions(),
		onMutate: async (variables) => {
			// Optimistic update: remove from UI immediately
			await queryClient.cancelQueries({
				queryKey: [["students", "getAll"]],
			});
			const previousStudents = queryClient.getQueryData([
				["students", "getAll"],
			]);

			// Optimistically update cache
			queryClient.setQueryData([["students", "getAll"]], (old: any) => {
				if (!old) return old;
				return old.filter((s: any) => s._id !== variables.id);
			});

			return { previousStudents };
		},
		onSuccess: () => {
			toast.success("Student deleted! 🗑️");
		},
		onError: (error, variables, context) => {
			// Rollback on error
			if (context?.previousStudents) {
				queryClient.setQueryData(
					[["students", "getAll"]],
					context.previousStudents
				);
			}
			toast.error(`Failed to delete: ${error.message}`);
		},
		onSettled: () => {
			queryClient.invalidateQueries({
				queryKey: [["students", "getAll"]],
			});
		},
	});

	// 📝 Form handlers
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (editingId) {
			// Update existing
			updateStudent.mutate({
				id: editingId,
				name: name || undefined,
				email: email || undefined,
			});
		} else {
			// Create new
			createStudent.mutate({
				name,
				email,
				studentNumber: parseInt(studentNumber),
			});
		}
	};

	const handleEdit = (student: any) => {
		setEditingId(student._id.toString());
		setName(student.name);
		setEmail(student.email);
	};

	const handleCancelEdit = () => {
		setEditingId(null);
		setName("");
		setEmail("");
		setStudentNumber("");
	};

	// Display search results or all students
	const displayStudents = searchQuery ? searchResults : students;

	return (
		<div className="container mx-auto p-6 space-y-6">
			<h1 className="text-3xl font-bold">🎓 Student Management</h1>

			{/* CREATE/UPDATE FORM */}
			<Card>
				<CardHeader>
					<CardTitle>
						{editingId ? "✏️ Edit Student" : "➕ Add New Student"}
					</CardTitle>
					<CardDescription>
						{editingId
							? "Update student information"
							: "Fill out the form to add a new student"}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="name">Name *</Label>
								<Input
									id="name"
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="John Doe"
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="email">Email *</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="john@example.com"
									required
								/>
							</div>
							{!editingId && (
								<div className="space-y-2">
									<Label htmlFor="studentNumber">
										Student Number *
									</Label>
									<Input
										id="studentNumber"
										type="number"
										value={studentNumber}
										onChange={(e) =>
											setStudentNumber(e.target.value)
										}
										placeholder="12345"
										required
									/>
								</div>
							)}
						</div>
						<div className="flex gap-2">
							<Button
								type="submit"
								disabled={
									createStudent.isPending ||
									updateStudent.isPending
								}
							>
								{createStudent.isPending ||
								updateStudent.isPending
									? "Saving..."
									: editingId
									? "Update Student"
									: "Create Student"}
							</Button>
							{editingId && (
								<Button
									type="button"
									variant="outline"
									onClick={handleCancelEdit}
								>
									Cancel
								</Button>
							)}
						</div>
					</form>
				</CardContent>
			</Card>

			{/* SEARCH BAR */}
			<Card>
				<CardHeader>
					<CardTitle>🔍 Search Students</CardTitle>
				</CardHeader>
				<CardContent>
					<Input
						placeholder="Search by name..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					{searchQuery && (
						<p className="text-sm text-muted-foreground mt-2">
							Found {searchResults?.length || 0} results
						</p>
					)}
				</CardContent>
			</Card>

			{/* STUDENT LIST */}
			<Card>
				<CardHeader>
					<CardTitle>📚 All Students</CardTitle>
					<CardDescription>
						{students?.length || 0} students total
					</CardDescription>
				</CardHeader>
				<CardContent>
					{/* Loading State */}
					{isLoading && (
						<div className="flex justify-center p-8">
							<Loader />
						</div>
					)}

					{/* Error State */}
					{error && (
						<div className="text-red-500 p-4 border border-red-300 rounded">
							❌ Error: {error.message}
						</div>
					)}

					{/* Empty State */}
					{!isLoading && displayStudents?.length === 0 && (
						<div className="text-center text-muted-foreground p-8">
							{searchQuery
								? "No students found matching your search"
								: "No students yet. Add one above! 👆"}
						</div>
					)}

					{/* Student List */}
					{displayStudents && displayStudents.length > 0 && (
						<div className="space-y-3">
							{displayStudents.map((student) => (
								<div
									key={student._id.toString()}
									className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
								>
									<div className="flex-1">
										<h3 className="font-semibold text-lg">
											{student.name}
										</h3>
										<p className="text-sm text-muted-foreground">
											📧 {student.email}
										</p>
										<p className="text-sm text-muted-foreground">
											🎓 Student #{student.studentNumber}
										</p>
										<p className="text-xs text-muted-foreground">
											ID: {student._id.toString()}
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => handleEdit(student)}
										>
											✏️ Edit
										</Button>
										<Button
											variant="destructive"
											size="sm"
											onClick={() =>
												deleteStudent.mutate({
													id: student._id.toString(),
												})
											}
											disabled={deleteStudent.isPending}
										>
											🗑️ Delete
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* INFO PANEL */}
			<Card>
				<CardHeader>
					<CardTitle>💡 What&apos;s Happening?</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-sm">
					<p>
						✅ <strong>Type Safety:</strong> Full TypeScript
						inference from backend to frontend
					</p>
					<p>
						✅ <strong>Optimistic Updates:</strong> Delete removes
						immediately, rolls back on error
					</p>
					<p>
						✅ <strong>Cache Invalidation:</strong> List
						auto-refreshes after mutations
					</p>
					<p>
						✅ <strong>Loading States:</strong> Proper feedback for
						all operations
					</p>
					<p>
						✅ <strong>Error Handling:</strong> Toast notifications
						for success/failure
					</p>
					<p>
						✅ <strong>Search:</strong> Conditional query only runs
						when needed
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
