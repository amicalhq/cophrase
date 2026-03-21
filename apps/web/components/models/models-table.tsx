"use client"

import { useState, useMemo } from "react"
import { trpc } from "@/lib/trpc/client"
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Button } from "@workspace/ui/components/button"
import { ModelsFilters } from "./models-filters"
import { modelsColumns } from "./models-columns"
import type { ModelRow } from "./models-page"

interface ModelsTableProps {
  models: ModelRow[]
  orgId: string
  onRefresh: () => void
}

export function ModelsTable({ models, orgId, onRefresh }: ModelsTableProps) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")

  const setDefaultMutation = trpc.models.setDefault.useMutation({
    onSettled: () => onRefresh(),
  })

  const removeMutation = trpc.models.remove.useMutation({
    onSettled: () => onRefresh(),
  })

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchesSearch = m.modelId
        .toLowerCase()
        .includes(search.toLowerCase())
      const matchesType = typeFilter === "all" || m.modelType === typeFilter
      return matchesSearch && matchesType
    })
  }, [models, search, typeFilter])

  const table = useReactTable({
    data: filteredModels,
    columns: modelsColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  function handleSetDefault(modelId: string) {
    setDefaultMutation.mutate({ orgId, id: modelId })
  }

  function handleDelete(modelId: string) {
    removeMutation.mutate({ orgId, id: modelId })
  }

  return (
    <div className="space-y-4">
      <ModelsFilters
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />

      <div className="rounded-md border">
        <Table style={{ tableLayout: "fixed", width: "100%" }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
                <TableHead style={{ width: 50 }} />
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={modelsColumns.length + 1}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No models enabled yet. Click &quot;Add models&quot; to get
                  started.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const isDefault =
                      cell.column.id === "isDefault" && !row.original.isDefault
                    return (
                      <TableCell
                        key={cell.id}
                        onClick={
                          isDefault
                            ? () => handleSetDefault(row.original.id)
                            : undefined
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          ···
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!row.original.isDefault && (
                          <DropdownMenuItem
                            onClick={() => handleSetDefault(row.original.id)}
                          >
                            Set as default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(row.original.id)}
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredModels.length} model(s)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
