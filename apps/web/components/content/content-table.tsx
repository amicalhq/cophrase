"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import { useQueryState } from "nuqs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { Button } from "@workspace/ui/components/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowUp01Icon, ArrowDown01Icon, UnfoldMoreIcon } from "@hugeicons/core-free-icons"
import { columns, type ContentRow } from "./columns"

interface ContentTypeOption {
  id: string
  name: string
}

interface ContentTableProps {
  data: ContentRow[]
  orgId: string
  projectId: string
  contentTypes: ContentTypeOption[]
}

export function ContentTable({ data, orgId, projectId, contentTypes }: ContentTableProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ])

  const [searchQuery, setSearchQuery] = useQueryState("q", { defaultValue: "" })
  const [typeFilter, setTypeFilter] = useQueryState("type", {
    defaultValue: "",
  })
  const [stageFilter, setStageFilter] = useQueryState("stage", {
    defaultValue: "all",
  })

  const selectedTypes = typeFilter ? typeFilter.split(",") : []

  // Derive unique stage names from data
  const stageOptions = useMemo(() => {
    const uniqueStages = new Set<string>()
    for (const row of data) {
      if (row.currentStageName) {
        uniqueStages.add(row.currentStageName)
      }
    }
    return [
      { label: "All stages", value: "all" },
      ...Array.from(uniqueStages)
        .sort()
        .map((name) => ({ label: name, value: name })),
    ]
  }, [data])

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    const types = typeFilter ? typeFilter.split(",") : []
    const filters: ColumnFiltersState = []
    if (types.length > 0) {
      filters.push({ id: "contentTypeName", value: types })
    }
    if (stageFilter !== "all") {
      filters.push({ id: "currentStageName", value: [stageFilter] })
    }
    return filters
  }, [typeFilter, stageFilter])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
      columnFilters,
      globalFilter: searchQuery,
    },
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const title = row.getValue("title") as string
      return title.toLowerCase().includes(filterValue.toLowerCase())
    },
    initialState: {
      pagination: { pageSize: 20 },
    },
  })

  const handleTypeChange = (value: string[]) => {
    setTypeFilter(value.length > 0 ? value.join(",") : "")
  }

  const handleStageChange = (value: string) => {
    setStageFilter(value)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value || "")}
          className="max-w-xs"
        />
        <ToggleGroup
          type="multiple"
          variant="outline"
          value={selectedTypes}
          onValueChange={handleTypeChange}
        >
          {contentTypes.map((ct) => (
            <ToggleGroupItem key={ct.id} value={ct.name}>
              {ct.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select value={stageFilter} onValueChange={handleStageChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            {stageOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table style={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            {table.getAllColumns().map((column) => (
              <col
                key={column.id}
                style={
                  column.id === "title"
                    ? { width: "auto" }
                    : { width: `${column.getSize()}px` }
                }
              />
            ))}
          </colgroup>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const align = (header.column.columnDef.meta as { align?: string })?.align
                  return (
                    <TableHead
                      key={header.id}
                      className={[
                        header.column.getCanSort()
                          ? "cursor-pointer select-none"
                          : "",
                        align === "right" ? "text-right" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span className="inline-flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {header.column.getCanSort() && (
                          header.column.getIsSorted() === "asc" ? (
                            <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} className="size-3.5 text-foreground" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3.5 text-foreground" />
                          ) : (
                            <HugeiconsIcon icon={UnfoldMoreIcon} strokeWidth={2} className="size-3.5 text-muted-foreground/50" />
                          )
                        )}
                      </span>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() =>
                    router.push(
                      `/orgs/${orgId}/projects/${projectId}/content/${row.original.id}/edit`,
                    )
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = (cell.column.columnDef.meta as { align?: string })?.align
                    return (
                      <TableCell
                        key={cell.id}
                        className={align === "right" ? "text-right" : ""}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  <p className="text-muted-foreground text-sm">
                    No content yet. Create your first piece to get started.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {table.getFilteredRowModel().rows.length} content piece
            {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
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
            <span className="text-muted-foreground text-sm">
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
      )}
    </div>
  )
}
