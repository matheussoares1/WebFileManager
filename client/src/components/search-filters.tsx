import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, SortAsc, SortDesc } from "lucide-react";

export type FileFilters = {
  search: string;
  mimeType: string;
  sortBy: "name" | "date" | "size";
  sortOrder: "asc" | "desc";
};

type SearchFiltersProps = {
  filters: FileFilters;
  onFiltersChange: (filters: FileFilters) => void;
};

const FILE_TYPES = [
  { value: "all", label: "Todos os tipos" },
  { value: "image/", label: "Imagens" },
  { value: "application/pdf", label: "PDF" },
  { value: "text/", label: "Texto" },
  { value: "application/", label: "Outros" },
];

export function SearchFilters({ filters, onFiltersChange }: SearchFiltersProps) {
  return (
    <div className="flex flex-col gap-4 mb-8">
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Input
            placeholder="Buscar arquivos..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          />
          <Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
        </div>
        <Select
          value={filters.mimeType || "all"}
          onValueChange={(value) => onFiltersChange({ ...filters, mimeType: value === "all" ? "" : value })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo de arquivo" />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-4">
        <Select
          value={filters.sortBy}
          onValueChange={(value) => 
            onFiltersChange({ 
              ...filters, 
              sortBy: value as "name" | "date" | "size" 
            })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nome</SelectItem>
            <SelectItem value="date">Data de upload</SelectItem>
            <SelectItem value="size">Tamanho</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => 
            onFiltersChange({
              ...filters,
              sortOrder: filters.sortOrder === "asc" ? "desc" : "asc",
            })
          }
        >
          {filters.sortOrder === "asc" ? (
            <SortAsc className="h-4 w-4" />
          ) : (
            <SortDesc className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}