import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ExternalLink, Star, Flame, Sparkles, ShoppingCart } from "lucide-react";
import { useState } from "react";

type Category = "all" | "rubs" | "seasonings" | "sauces";

interface Product {
  id: number;
  name: string;
  brand: string;
  category: "rubs" | "seasonings" | "sauces";
  description: string;
  tags: string[];
  rating: number;
  reviewCount: string;
  price: string;
  purchaseUrl: string;
  isNew?: boolean;
  isPopular?: boolean;
  isFeatured?: boolean;
  usedFor: string[];
}

const products: Product[] = [
  // ── RUBS ──────────────────────────────────────────────────────────────────
  {
    id: 1,
    name: "Holy Cow BBQ Rub",
    brand: "Meat Church",
    category: "rubs",
    description:
      "A Texas-style beef rub with coarse black pepper, garlic, and a touch of spice. The go-to for competition brisket and beef ribs.",
    tags: ["Texas Style", "Competition"],
    rating: 4.8,
    reviewCount: "4.2k",
    price: "$10.99",
    purchaseUrl: "https://www.amazon.com/dp/B01LY8TWNC",
    isPopular: true,
    usedFor: ["Brisket", "Beef Ribs", "Steaks"],
  },
  {
    id: 2,
    name: "The BBQ Rub",
    brand: "Killer Hogs",
    category: "rubs",
    description:
      "Malcom Reed's legendary all-purpose rub. Deep mahogany bark with a savory-sweet balance that works on everything from pork butt to chicken.",
    tags: ["All-Purpose", "Award Winning"],
    rating: 4.9,
    reviewCount: "6.1k",
    price: "$14.95",
    purchaseUrl: "https://www.amazon.com/dp/B00BCBHE8M",
    isPopular: true,
    isFeatured: true,
    usedFor: ["Pork Butt", "Ribs", "Chicken"],
  },
  {
    id: 3,
    name: "Gospel All-Purpose Rub",
    brand: "Meat Church",
    category: "rubs",
    description:
      "A beautifully balanced all-purpose BBQ rub with a hint of honey and sweet pepper. Versatile enough for any protein.",
    tags: ["All-Purpose", "Honey Sweet"],
    rating: 4.7,
    reviewCount: "3.5k",
    price: "$10.99",
    purchaseUrl: "https://www.amazon.com/dp/B07MSCQYXZ",
    isNew: true,
    usedFor: ["Chicken", "Pork", "Vegetables"],
  },
  {
    id: 4,
    name: "Peach Rub",
    brand: "Heath Riles BBQ",
    category: "rubs",
    description:
      "A fruity competition-grade rub with real peach flavor. Incredible on pork and chicken — builds a beautiful color and bark.",
    tags: ["Fruity", "Competition"],
    rating: 4.8,
    reviewCount: "1.9k",
    price: "$12.99",
    purchaseUrl: "https://www.amazon.com/dp/B07P9H6WQB",
    isNew: true,
    usedFor: ["Pork Shoulder", "Ribs", "Chicken Thighs"],
  },
  {
    id: 5,
    name: "Secret Weapon Pork & Poultry Rub",
    brand: "Oakridge BBQ",
    category: "rubs",
    description:
      "A deeply savory, umami-forward rub loaded with herbs and aromatic spices. Used by pitmasters to win championships year after year.",
    tags: ["Competition", "Savory"],
    rating: 4.7,
    reviewCount: "2.2k",
    price: "$13.50",
    purchaseUrl: "https://www.amazon.com/dp/B009AEHCGE",
    isPopular: true,
    usedFor: ["Pork Butt", "Whole Chicken", "Turkey"],
  },
  {
    id: 6,
    name: "Butt Rub",
    brand: "Bad Byron's",
    category: "rubs",
    description:
      "A cult-classic Carolina rub with earthy spices and just the right amount of heat. Perfect for slow-smoked pork.",
    tags: ["Carolina Style", "Classic"],
    rating: 4.6,
    reviewCount: "5.8k",
    price: "$8.49",
    purchaseUrl: "https://www.amazon.com/dp/B003YBUCJM",
    isPopular: true,
    usedFor: ["Pork Shoulder", "Baby Back Ribs"],
  },

  // ── SEASONINGS ────────────────────────────────────────────────────────────
  {
    id: 7,
    name: "Smokehouse Maple Seasoning",
    brand: "McCormick Grill Mates",
    category: "seasonings",
    description:
      "A warm blend of maple, smoked paprika, and spices that adds depth to pork, chicken, and even grilled vegetables.",
    tags: ["Sweet Smoke", "Everyday"],
    rating: 4.5,
    reviewCount: "8.3k",
    price: "$5.49",
    purchaseUrl: "https://www.amazon.com/dp/B07B43SXNP",
    isPopular: true,
    usedFor: ["Pork Chops", "Salmon", "Vegetables"],
  },
  {
    id: 8,
    name: "Hardcore Carnivore Black",
    brand: "Jess Pryles",
    category: "seasonings",
    description:
      "Made with activated charcoal and coarse salt, this rub creates a dramatic jet-black bark on brisket and steaks with intense umami flavor.",
    tags: ["Beef Forward", "Show Stopper"],
    rating: 4.7,
    reviewCount: "2.1k",
    price: "$15.99",
    purchaseUrl: "https://www.amazon.com/dp/B07HH8JBV1",
    isNew: true,
    isFeatured: true,
    usedFor: ["Brisket", "Ribeye", "Short Ribs"],
  },
  {
    id: 9,
    name: "Traeger Beef Rub",
    brand: "Traeger",
    category: "seasonings",
    description:
      "Designed specifically for pellet smokers, this blend of coffee, garlic, and chili builds a rich crust on any beef cut.",
    tags: ["Pellet Grill", "Beef"],
    rating: 4.6,
    reviewCount: "3.7k",
    price: "$9.99",
    purchaseUrl: "https://www.amazon.com/dp/B07C7HY6WC",
    usedFor: ["Brisket", "Chuck Roast", "Burgers"],
  },
  {
    id: 10,
    name: "Everything Bagel Seasoning",
    brand: "Trader Joe's",
    category: "seasonings",
    description:
      "An unexpected BBQ secret weapon — poppy seeds, sesame, garlic, and salt create a unique crunchy crust on grilled salmon and chicken.",
    tags: ["Unique", "Trending"],
    rating: 4.8,
    reviewCount: "12k",
    price: "$3.99",
    purchaseUrl: "https://www.amazon.com/dp/B07GVXNB7T",
    isNew: true,
    usedFor: ["Salmon", "Chicken Breast", "Avocado"],
  },

  // ── SAUCES ────────────────────────────────────────────────────────────────
  {
    id: 11,
    name: "Original BBQ Sauce",
    brand: "Stubb's",
    category: "sauces",
    description:
      "An Austin, Texas legend. Made with all-natural ingredients — no corn syrup. Tangy, smoky, and perfectly balanced with tomato and a black pepper kick.",
    tags: ["Texas Style", "No Corn Syrup"],
    rating: 4.7,
    reviewCount: "9.4k",
    price: "$6.99",
    purchaseUrl: "https://www.amazon.com/dp/B01N7PVUAB",
    isPopular: true,
    usedFor: ["Ribs", "Brisket", "Pulled Pork"],
  },
  {
    id: 12,
    name: "Blues Hog Champions' Blend",
    brand: "Blues Hog",
    category: "sauces",
    description:
      "A thick competition BBQ sauce with rich tomato, tangy vinegar, and just enough heat. Has won more BBQ championships than any other sauce.",
    tags: ["Competition", "Award Winning"],
    rating: 4.9,
    reviewCount: "3.8k",
    price: "$12.99",
    purchaseUrl: "https://www.amazon.com/dp/B00CTQVNB4",
    isPopular: true,
    isFeatured: true,
    usedFor: ["Ribs", "Pulled Pork", "Chicken"],
  },
  {
    id: 13,
    name: "Carolina Gold Barbecue Sauce",
    brand: "Lillie's Q",
    category: "sauces",
    description:
      "A tangy South Carolina-style mustard sauce with a sweet, complex finish. Transforms pulled pork sandwiches into something unforgettable.",
    tags: ["Mustard Base", "Carolina Style"],
    rating: 4.6,
    reviewCount: "2.6k",
    price: "$9.99",
    purchaseUrl: "https://www.amazon.com/dp/B00T3GDXGE",
    isNew: true,
    usedFor: ["Pulled Pork", "Sausage", "Grilled Chicken"],
  },
  {
    id: 14,
    name: "Tennessee Red Sauce",
    brand: "Blues Hog",
    category: "sauces",
    description:
      "A thin, tangy vinegar-and-pepper sauce in the tradition of Tennessee whole-hog BBQ. Cuts through rich pork fat like nothing else.",
    tags: ["Vinegar Base", "Tennessee Style"],
    rating: 4.8,
    reviewCount: "1.7k",
    price: "$9.99",
    purchaseUrl: "https://www.amazon.com/dp/B00GIK1Y3E",
    usedFor: ["Pulled Pork", "Whole Hog", "Chicken"],
  },
  {
    id: 15,
    name: "Honey Sweet BBQ Sauce",
    brand: "Rufus Teague",
    category: "sauces",
    description:
      "A thick, rich Kansas City-style sauce with real honey, a hint of bourbon, and balanced spices. Glazes beautifully when applied in the last 20 minutes of a cook.",
    tags: ["Kansas City", "Honey Bourbon"],
    rating: 4.7,
    reviewCount: "4.5k",
    price: "$8.99",
    purchaseUrl: "https://www.amazon.com/dp/B01M3R9DNN",
    isPopular: true,
    usedFor: ["Ribs", "Wings", "Pork Belly"],
  },
  {
    id: 16,
    name: "Spicy BBQ Sauce",
    brand: "Killer Hogs",
    category: "sauces",
    description:
      "Malcom Reed's signature sauce with a serious heat kick. Layers of tomato, apple cider vinegar, and cayenne that build as you eat.",
    tags: ["Spicy", "Competition"],
    rating: 4.8,
    reviewCount: "2.2k",
    price: "$13.95",
    purchaseUrl: "https://www.amazon.com/dp/B00BCBGTFM",
    isNew: true,
    usedFor: ["Wings", "Ribs", "Burgers"],
  },
];

const categories: { label: string; value: Category }[] = [
  { label: "All Products", value: "all" },
  { label: "Rubs", value: "rubs" },
  { label: "Seasonings", value: "seasonings" },
  { label: "Sauces", value: "sauces" },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/40"
          }`}
        />
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const categoryColors: Record<string, string> = {
    rubs: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    seasonings: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    sauces: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <Card className="border bg-card flex flex-col h-full hover:border-primary/40 transition-colors">
      <CardHeader className="pb-3 space-y-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={`text-xs font-medium ${categoryColors[product.category]}`}>
              {product.category.charAt(0).toUpperCase() + product.category.slice(1, -1)}
            </Badge>
            {product.isFeatured && (
              <Badge className="text-xs bg-primary/20 text-primary border border-primary/30 hover:bg-primary/20">
                <Flame className="w-3 h-3 mr-1" /> Featured
              </Badge>
            )}
            {product.isNew && (
              <Badge className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20">
                <Sparkles className="w-3 h-3 mr-1" /> New
              </Badge>
            )}
            {product.isPopular && !product.isFeatured && (
              <Badge className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">
                Popular
              </Badge>
            )}
          </div>
          <span className="text-lg font-bold text-primary shrink-0">{product.price}</span>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{product.brand}</p>
          <h3 className="font-semibold text-base leading-tight mt-0.5">{product.name}</h3>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <StarRating rating={product.rating} />
          <span className="text-sm font-semibold text-amber-400">{product.rating}</span>
          <span className="text-xs text-muted-foreground">({product.reviewCount} reviews)</span>
        </div>
      </CardHeader>

      <CardContent className="pb-3 flex-1">
        <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.tags.map((tag) => (
            <span key={tag} className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-md border border-border/50">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-3">
          <p className="text-xs text-muted-foreground font-medium mb-1.5">Great for:</p>
          <div className="flex flex-wrap gap-1">
            {product.usedFor.map((use) => (
              <span key={use} className="text-xs text-foreground/70 bg-muted/30 px-2 py-0.5 rounded">
                {use}
              </span>
            ))}
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          asChild
          className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          size="sm"
        >
          <a href={product.purchaseUrl} target="_blank" rel="noopener noreferrer">
            <ShoppingCart className="w-4 h-4" />
            Buy on Amazon
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ShopPage() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [showNewOnly, setShowNewOnly] = useState(false);

  const filtered = products.filter((p) => {
    if (activeCategory !== "all" && p.category !== activeCategory) return false;
    if (showNewOnly && !p.isNew) return false;
    return true;
  });

  const featuredProducts = products.filter((p) => p.isFeatured);

  const counts: Record<Category, number> = {
    all: products.length,
    rubs: products.filter((p) => p.category === "rubs").length,
    seasonings: products.filter((p) => p.category === "seasonings").length,
    sauces: products.filter((p) => p.category === "sauces").length,
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">BBQ Shop</h1>
            <p className="text-muted-foreground mt-1">
              Top-rated rubs, seasonings, and sauces trusted by competition pitmasters.
            </p>
          </div>
          <button
            onClick={() => setShowNewOnly((v) => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors ${
              showNewOnly
                ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                : "bg-muted/40 text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            New Arrivals
          </button>
        </div>

        {/* Featured strip */}
        {activeCategory === "all" && !showNewOnly && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-base">PitKing Picks</h2>
              <span className="text-xs text-muted-foreground">— Competition favorites</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featuredProducts.map((p) => (
                <a
                  key={p.id}
                  href={p.purchaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border/60 hover:border-primary/40 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{p.brand}</p>
                    <p className="font-semibold text-sm leading-tight truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <StarRating rating={p.rating} />
                      <span className="text-xs text-muted-foreground">({p.reviewCount})</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-bold text-primary text-sm">{p.price}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === cat.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {cat.label}
              <span className="ml-1.5 text-xs opacity-70">({counts[cat.value]})</span>
            </button>
          ))}
        </div>

        {/* Product grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed rounded-lg bg-muted/10">
            <ShoppingCart className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No products match this filter.</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center pb-4">
          PitKing may earn a commission on qualifying purchases via Amazon Associates links.
          Prices and availability may vary.
        </p>
      </div>
    </AppLayout>
  );
}
