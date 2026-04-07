'use client'
import { useEffect, useMemo, useState } from "react";
import { firestore } from "../firebase";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc } from "firebase/firestore";
import CameraComponent from "./cameraComponent";
import RecipeSuggestion from "./recipeSuggestion";
import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";
import "./page.css";

/** Shown in Firestore when the collection is empty (matches redesign mock). */
const DEMO_INVENTORY = [
  { name: "green apple", quantity: 8 },
  { name: "banana", quantity: 7 },
  { name: "boxes", quantity: 4 },
  { name: "doormat", quantity: 2 },
  { name: "coffee", quantity: 2 },
  { name: "forklift", quantity: 1 },
];

export default function Home() {
  const [inventory, setInventory] = useState([])
  const [open, setOpen] = useState(false)
  const [itemName, setItemName] = useState('')
  const [searchTerm, setSearchTerm] = useState('');
  const [openCamera, setOpenCamera] = useState(false);
  const [openRecipe, setOpenRecipe] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [uiError, setUiError] = useState("");
  const [saving, setSaving] = useState(false);

  const withTimeout = async (promise, ms, label) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms. Check Firestore is enabled + rules allow writes.`));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const fetchInventoryList = async () => {
    const snapshot = query(collection(firestore, "inventory"));
    const docs = await withTimeout(getDocs(snapshot), 8000, "Loading inventory");
    const inventoryList = [];
    docs.forEach((d) => {
      inventoryList.push({
        name: d.id,
        ...d.data(),
      });
    });
    return inventoryList;
  };

  const updateInventory = async () => {
    try {
      const inventoryList = await fetchInventoryList();
      setInventory(inventoryList);
    } catch (err) {
      console.error("Failed to load inventory:", err);
      setUiError(err?.message || "Failed to load inventory.");
    }
  };

  const addItem = async (item, camera = false) => {
    setUiError("");
    if (!item || !item.trim()) return;
    let normalized = item.trim().toLowerCase();

    if (camera === true) {
      inventory.forEach(itemDoc => {
        if (
          normalized.includes(itemDoc.name.toLowerCase()) ||
          itemDoc.name.toLowerCase().includes(normalized)
        ) {
          normalized = itemDoc.name.toLowerCase();
        }
      });
    }

    setSaving(true);
    try {
      const docRef = doc(collection(firestore, 'inventory'), normalized)
      const docSnap = await withTimeout(getDoc(docRef), 8000, "Reading item")

      if (docSnap.exists()) {
        const { quantity } = docSnap.data()
        await withTimeout(setDoc(docRef, { quantity: quantity + 1 }), 8000, "Saving item")
      } else {
        await withTimeout(setDoc(docRef, { quantity: 1 }), 8000, "Saving item")
      }
      await updateInventory()
    } catch (err) {
      console.error("Failed to add item:", err);
      setUiError(err?.message || "Failed to add item.");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  const removeItem = async (item) => {
    setUiError("");
    try {
      const docRef = doc(collection(firestore, 'inventory'), item)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const { quantity } = docSnap.data()
        if (quantity === 1) {
          await deleteDoc(docRef)
        } else {
          await setDoc(docRef, { quantity: quantity - 1 })
        }
      }
      await updateInventory()
    } catch (err) {
      console.error("Failed to remove item:", err);
      setUiError(err?.message || "Failed to remove item.");
    }
  }

  const deleteItem = async (item) => {
    setUiError("");
    try {
      const docRef = doc(collection(firestore, 'inventory'), item)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        await deleteDoc(docRef)
      }
      await updateInventory()
    } catch (err) {
      console.error("Failed to delete item:", err);
      setUiError(err?.message || "Failed to delete item.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setUiError("");
        const list = await fetchInventoryList();
        if (cancelled) return;
        if (list.length === 0) {
          for (const row of DEMO_INVENTORY) {
            await withTimeout(
              setDoc(doc(collection(firestore, "inventory"), row.name), { quantity: row.quantity }),
              8000,
              "Seeding demo item"
            );
          }
          const seeded = await fetchInventoryList();
          if (!cancelled) setInventory(seeded);
        } else {
          setInventory(list);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load / seed inventory:", err);
          setUiError(err?.message || "Failed to load inventory.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = () => setOpen(true)
  const handleClose = () => setOpen(false)

  const handleCameraOpen = () => setOpenCamera(true)
  const handleCameraClose = () => setOpenCamera(false)

  const handleRecipeOpen = () => setOpenRecipe(true)
  const handleRecipeClose = () => setOpenRecipe(false)

  const handleDetection = async (detectedObject) => {
    handleCameraClose()
    if (detectedObject !== 'none') {
      await addItem(detectedObject, true);
    } else {
      alert('No valid object detected');
    }
  };

  const formatName = (name) => name.charAt(0).toUpperCase() + name.slice(1);

  const categoryKeywords = {
    Fruits: ["apple", "banana", "orange", "grape", "fruit", "mango", "berry", "pear"],
    Household: ["detergent", "soap", "cleaner", "doormat", "paper", "tissue", "house"],
    Beverages: ["coffee", "tea", "juice", "drink", "milk", "water", "soda"],
    Storage: ["box", "container", "jar", "bag", "storage"],
    Equipment: ["forklift", "machine", "tool"],
  };

  const getCategory = (name) => {
    const lower = name.toLowerCase();
    const found = Object.entries(categoryKeywords).find(([, keywords]) =>
      keywords.some((keyword) => lower.includes(keyword))
    );
    return found ? found[0] : "Other";
  };

  const getEmoji = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes("apple")) return "🍏";
    if (lower.includes("banana")) return "🍌";
    if (lower.includes("box")) return "📦";
    if (lower.includes("coffee")) return "☕";
    if (lower.includes("forklift")) return "🏗️";
    if (lower.includes("door") || lower.includes("mat")) return "🚪";
    return "📦";
  };

  const totalItems = useMemo(
    () => inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [inventory]
  );

  const categorizedItems = useMemo(
    () => inventory.map((item) => ({ ...item, category: getCategory(item.name) })),
    [inventory]
  );

  const categories = useMemo(() => {
    const set = new Set(categorizedItems.map((item) => item.category));
    return ["All", ...Array.from(set)];
  }, [categorizedItems]);

  const filteredItems = useMemo(() => {
    return categorizedItems.filter(({ name, category }) => {
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = activeCategory === "All" || category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [categorizedItems, searchTerm, activeCategory]);

  const overviewCounts = useMemo(() => {
    return inventory
      .map((item) => ({ name: item.name, value: Number(item.quantity || 0) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [inventory]);

  const chartColors = ["#3ac98e", "#f06086", "#f5b942", "#e8633a", "#c15bf0", "#5b8ef0"];
  const donutRadius = 46;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let cumulativeOffset = 0;

  return (
    <div className="inventory-app">
      <div className="app-shell">
        {uiError ? (
          <div className="ui-error" role="alert">
            {uiError}
          </div>
        ) : null}

        <header className="app-header">
          <div className="logo-block">
            <div className="logo-icon">📦</div>
            <div>
              <div className="logo-text">Pantry.io</div>
              <div className="logo-sub">Smart Inventory Manager</div>
            </div>
          </div>

          <div className="header-actions">
            <button className="btn btn-secondary" onClick={handleCameraOpen}>📷 Capture Item</button>
            <button className="btn btn-secondary" onClick={handleRecipeOpen}>🍽️ Get Recipe</button>
            <button className="btn btn-primary" onClick={handleOpen}>＋ Add New Item</button>
          </div>
        </header>

        <section className="stats-row">
          <div className="stat-card">
            <div className="stat-label">Total Items</div>
            <div className="stat-value">{totalItems}</div>
            <div className="stat-change">Live inventory count</div>
            <div className="stat-icon">📦</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Categories</div>
            <div className="stat-value">{categories.length - 1}</div>
            <div className="stat-change">Based on item names</div>
            <div className="stat-icon">🗂️</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Low Stock</div>
            <div className="stat-value">{inventory.filter((item) => item.quantity <= 2).length}</div>
            <div className="stat-change">Items with quantity ≤ 2</div>
            <div className="stat-icon">⚡</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Recipes Ready</div>
            <div className="stat-value">{inventory.length}</div>
            <div className="stat-change">Use available inventory</div>
            <div className="stat-icon">🍳</div>
          </div>
        </section>

        <main className="main-grid">
          <div className="glass-card chart-card">
            <div className="card-title">Inventory Overview</div>
            <div className="card-subtitle">Distribution by category</div>

            <div className="donut-wrapper">
              <svg className="donut-svg" viewBox="0 0 120 120" aria-label="Inventory donut chart">
                {overviewCounts.map((entry, index) => {
                  const segment = totalItems > 0 ? (entry.value / totalItems) * donutCircumference : 0;
                  const dashArray = `${segment} ${Math.max(donutCircumference - segment, 0)}`;
                  const circle = (
                    <circle
                      key={entry.name}
                      cx="60"
                      cy="60"
                      r={donutRadius}
                      fill="none"
                      stroke={chartColors[index % chartColors.length]}
                      strokeWidth="18"
                      strokeDasharray={dashArray}
                      strokeDashoffset={-cumulativeOffset}
                    />
                  );
                  cumulativeOffset += segment;
                  return circle;
                })}
              </svg>
              <div className="donut-center">
                <div className="donut-center-num">{totalItems}</div>
                <div className="donut-center-lbl">total items</div>
              </div>
            </div>

            <div className="legend">
              {overviewCounts.map((entry, index) => (
                <div className="legend-item" key={entry.name}>
                  <span className="legend-dot" style={{ background: chartColors[index % chartColors.length] }}></span>
                  <span className="legend-name">{formatName(entry.name)}</span>
                  <span className="legend-val">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card items-card">
            <div className="items-header">
              <div className="items-title">Inventory Items <span className="badge">{totalItems} items</span></div>
              <div className="search-wrap">
                <span className="search-icon">🔍</span>
                <input
                  className="search-input"
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="cat-tabs">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`cat-tab ${activeCategory === category ? "active" : ""}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="items-list">
              {filteredItems.length === 0 ? (
                <div className="empty-items">No items match your filters.</div>
              ) : (
                filteredItems.map(({ name, quantity, category }) => (
                  <div className="item-row" key={name}>
                    <div className="item-color">{getEmoji(name)}</div>
                    <div className="item-info">
                      <div className="item-name">{formatName(name)}</div>
                      <div className="item-category">{category}</div>
                    </div>
                    <div className="item-qty">
                      <button className="qty-btn" onClick={() => removeItem(name)} aria-label={`Decrease ${name}`}>−</button>
                      <span className="qty-num">{quantity}</span>
                      <button className="qty-btn" onClick={() => addItem(name)} aria-label={`Increase ${name}`}>+</button>
                    </div>
                    <div className="item-actions">
                      <button className="icon-btn del-btn" onClick={() => deleteItem(name)} aria-label={`Delete ${name}`}>🗑</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {open && (
        <div className="modal-overlay" onClick={handleClose}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Item</h3>
            <div className="modal-row">
              <input
                className="search-input"
                type="text"
                value={itemName}
                placeholder="Item name"
                onChange={(e) => setItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (async () => {
                      try {
                        await addItem(itemName);
                        setItemName('');
                        handleClose();
                      } catch {
                        // error is shown in UI
                      }
                    })();
                  }
                }}
              />
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={async () => {
                  try {
                    await addItem(itemName);
                    setItemName('');
                    handleClose();
                  } catch {
                    // error is shown in UI
                  }
                }}
              >
                {saving ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={openCamera} onClose={handleCameraClose} maxWidth="md" fullWidth>
        <DialogTitle className="dialog-title-wrap">
          <span>Identify item using image recognition</span>
          <IconButton onClick={handleCameraClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <CameraComponent
            onDetection={handleDetection}
            onClose={handleCameraClose}
            inventoryItems={inventory.map((item) => item.name)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openRecipe} onClose={handleRecipeClose} maxWidth="md" fullWidth>
        <DialogTitle className="dialog-title-wrap">
          <span>Generate recipe from available inventory</span>
          <IconButton onClick={handleRecipeClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <RecipeSuggestion
            onClose={handleRecipeClose}
            inventoryItems={inventory.map((item) => item.name)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
