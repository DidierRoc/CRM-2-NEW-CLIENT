import { useState, useEffect, useMemo } from 'react';
import { Calculator, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProfitSimulator from './ProfitSimulator';

interface Product {
  id: string;
  nom: string;
  interets: string;
  duree: string;
  prix_minimum: number;
  prix_maximum: number;
  periode_disponibilite?: string;
  categorie?: string;
}

interface Props {
  products: Product[];
  variant?: 'crm' | 'client';
  clientName?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; activeBg: string }> = {
  livret: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', activeBg: 'bg-emerald-600' },
  compte_a_theme: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', activeBg: 'bg-blue-600' },
  assurance_vie: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', activeBg: 'bg-purple-600' },
  crypto: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', activeBg: 'bg-amber-600' },
};

const GeneralSimulator = ({ products, variant = 'crm', clientName }: Props) => {
  const isClient = variant === 'client';

  // Group products by category
  const categories = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const cat = p.categorie || 'autre';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [products]);

  const categoryKeys = useMemo(() => [...categories.keys()], [categories]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');

  // Auto-select first category
  useEffect(() => {
    if (categoryKeys.length > 0 && !categoryKeys.includes(selectedCategory)) {
      setSelectedCategory(categoryKeys[0]);
    }
  }, [categoryKeys, selectedCategory]);

  // Products in selected category
  const categoryProducts = useMemo(
    () => categories.get(selectedCategory) || [],
    [categories, selectedCategory]
  );

  // Auto-select first product when category changes
  useEffect(() => {
    if (categoryProducts.length > 0 && !categoryProducts.find(p => p.id === selectedProductId)) {
      setSelectedProductId(categoryProducts[0].id);
    }
  }, [categoryProducts, selectedProductId]);

  const selectedProduct = categoryProducts.find(p => p.id === selectedProductId);

  if (products.length === 0) {
    return (
      <div className={cn(
        "rounded-xl border p-6 text-center",
        isClient ? "bg-white border-slate-100" : "bg-card border-border"
      )}>
        <Calculator className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucun produit disponible pour la simulation</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categoryKeys.map(cat => {
          const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.livret;
          const isActive = selectedCategory === cat;
          const count = categories.get(cat)?.length || 0;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5",
                isActive
                  ? `${colors.activeBg} text-white shadow-sm`
                  : isClient
                    ? `${colors.bg} ${colors.border} ${colors.text} border hover:shadow-sm`
                    : "bg-muted text-muted-foreground border border-border hover:bg-accent"
              )}
            >
              {categories.get(cat)?.map((product) => product.nom).join(', ') || cat}
              <span className={cn(
                "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                isActive ? "bg-white/25" : "bg-black/10"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Product selector (compact) */}
      {categoryProducts.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {categoryProducts.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProductId(p.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all",
                selectedProductId === p.id
                  ? isClient
                    ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                    : "bg-primary text-primary-foreground border-primary"
                  : isClient
                    ? "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-accent/50"
              )}
            >
              <ChevronRight className={cn(
                "w-3 h-3 shrink-0 transition-transform",
                selectedProductId === p.id && "rotate-90"
              )} />
              <span className="font-medium truncate max-w-[140px]">{p.nom}</span>
              <span className={cn(
                "text-[10px] opacity-70",
                selectedProductId === p.id ? "text-white/70" : ""
              )}>
                {p.interets} · {p.duree}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Single product label */}
      {categoryProducts.length === 1 && selectedProduct && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
          isClient ? "bg-slate-50 border border-slate-100" : "bg-muted/50 border border-border"
        )}>
          <ChevronRight className={cn("w-3 h-3", isClient ? "text-slate-400" : "text-muted-foreground")} />
          <span className="font-medium">{selectedProduct.nom}</span>
          <span className="text-muted-foreground">— {selectedProduct.interets} · {selectedProduct.duree}</span>
        </div>
      )}

      {/* Simulator */}
      {selectedProduct && (
        <ProfitSimulator
          key={selectedProduct.id}
          product={selectedProduct}
          variant={variant}
          clientName={clientName}
          lockDuration
        />
      )}
    </div>
  );
};

export default GeneralSimulator;
