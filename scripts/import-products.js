/**
 * Script d'import des produits depuis Excel
 * Usage: node scripts/import-products.js <fichier-excel>
 */

const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const API_BASE_URL = 'http://localhost:8080/api/v1';
const EXCEL_FILE = process.argv[2] || './comprehension_du_projet/LISTE DES PRODUITS.xlsx';

// Types de prix supportés
const PRICE_TYPES = {
  PURCHASE: 'PURCHASE',        // Prix d'achat fournisseur
  COST: 'COST',                // Prix de revient
  WHOLESALE: 'WHOLESALE',      // Prix de gros
  RETAIL: 'RETAIL',            // Prix de détail
  PROMOTIONAL: 'PROMOTIONAL',  // Prix promotionnel
  DISTRIBUTOR: 'DISTRIBUTOR',  // Prix distributeur
  COMMERCIAL: 'COMMERCIAL'     // Prix commercial
};

/**
 * Lire le fichier Excel
 */
function readExcelFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`Erreur: Le fichier ${filePath} n'existe pas`);
      process.exit(1);
    }

    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    console.log(`✓ Fichier lu avec succès: ${data.length} lignes trouvées`);
    return data;
  } catch (error) {
    console.error('Erreur lors de la lecture du fichier Excel:', error.message);
    process.exit(1);
  }
}

/**
 * Mapper les données Excel vers le format API
 */
function mapProductData(excelRow) {
  // Adapter selon la structure réelle du fichier Excel
  const product = {
    sku: excelRow['Code'] || excelRow['SKU'] || excelRow['Référence'] || '',
    barcode: excelRow['Code-barres'] || excelRow['Barcode'] || null,
    category: mapCategory(excelRow['Catégorie'] || excelRow['Category']),
    unit: mapUnit(excelRow['Unité'] || excelRow['Unit'] || excelRow['Unite']),
    designation: excelRow['Désignation'] || excelRow['Designation'] || excelRow['Nom'] || '',
    brandName: excelRow['Marque'] || excelRow['Brand'] || null,
    variantName: excelRow['Variété'] || excelRow['Variety'] || excelRow['Variant'] || null,
    leadTimeDays: excelRow['Délai'] || excelRow['LeadTime'] || null,
    safetyStockDays: excelRow['Stock Sécurité'] || excelRow['SafetyStock'] || null,
    active: true,
    prices: extractPrices(excelRow)
  };

  return product;
}

/**
 * Mapper la catégorie
 */
function mapCategory(category) {
  const categoryMap = {
    'MATIÈRE PREMIÈRE': 'RAW_MATERIAL',
    'RAW_MATERIAL': 'RAW_MATERIAL',
    'MP': 'RAW_MATERIAL',
    'CONSOMMABLE': 'CONSUMABLE',
    'CONSUMABLE': 'CONSUMABLE',
    'PRODUIT FINI': 'FINISHED_PRODUCT',
    'FINISHED_PRODUCT': 'FINISHED_PRODUCT',
    'PF': 'FINISHED_PRODUCT',
    'EMBALLAGE': 'PACKAGING',
    'PACKAGING': 'PACKAGING',
    'ÉQUIPEMENT': 'EQUIPMENT',
    'EQUIPMENT': 'EQUIPMENT'
  };
  
  return categoryMap[category?.toUpperCase()] || 'RAW_MATERIAL';
}

/**
 * Mapper l'unité
 */
function mapUnit(unit) {
  const unitMap = {
    'KG': 'KG',
    'SACHET 42G': 'SACHET_42G',
    'SACHET': 'SACHET_42G',
    'SEAU 1L': 'SEAU_1L',
    'SEAU 5L': 'SEAU_5L',
    'SEAU 10L': 'SEAU_10L',
    'CARTON': 'CARTON',
    'SAC': 'SAC',
    'LITRE': 'LITER',
    'L': 'LITER'
  };
  
  return unitMap[unit?.toUpperCase()] || 'KG';
}

/**
 * Extraire les prix multiples depuis la ligne Excel
 */
function extractPrices(excelRow) {
  const prices = [];

  // Prix d'achat
  if (excelRow['Prix Achat'] || excelRow['Purchase Price']) {
    prices.push({
      priceType: PRICE_TYPES.PURCHASE,
      price: parseFloat(excelRow['Prix Achat'] || excelRow['Purchase Price']),
      currency: 'XAF',
      active: true
    });
  }

  // Prix de revient
  if (excelRow['Prix Revient'] || excelRow['Cost Price']) {
    prices.push({
      priceType: PRICE_TYPES.COST,
      price: parseFloat(excelRow['Prix Revient'] || excelRow['Cost Price']),
      currency: 'XAF',
      active: true
    });
  }

  // Prix de gros
  if (excelRow['Prix Gros'] || excelRow['Wholesale Price']) {
    prices.push({
      priceType: PRICE_TYPES.WHOLESALE,
      price: parseFloat(excelRow['Prix Gros'] || excelRow['Wholesale Price']),
      currency: 'XAF',
      minQuantity: 10, // Quantité minimum pour prix de gros
      active: true
    });
  }

  // Prix de détail
  if (excelRow['Prix Détail'] || excelRow['Retail Price']) {
    prices.push({
      priceType: PRICE_TYPES.RETAIL,
      price: parseFloat(excelRow['Prix Détail'] || excelRow['Retail Price']),
      currency: 'XAF',
      active: true
    });
  }

  // Prix promotionnel
  if (excelRow['Prix Promo'] || excelRow['Promotional Price']) {
    prices.push({
      priceType: PRICE_TYPES.PROMOTIONAL,
      price: parseFloat(excelRow['Prix Promo'] || excelRow['Promotional Price']),
      currency: 'XAF',
      validFrom: excelRow['Promo Du'] || null,
      validTo: excelRow['Promo Au'] || null,
      active: true
    });
  }

  // Prix distributeur
  if (excelRow['Prix Distributeur'] || excelRow['Distributor Price']) {
    prices.push({
      priceType: PRICE_TYPES.DISTRIBUTOR,
      price: parseFloat(excelRow['Prix Distributeur'] || excelRow['Distributor Price']),
      currency: 'XAF',
      minQuantity: 50,
      active: true
    });
  }

  // Prix commercial
  if (excelRow['Prix Commercial'] || excelRow['Commercial Price']) {
    prices.push({
      priceType: PRICE_TYPES.COMMERCIAL,
      price: parseFloat(excelRow['Prix Commercial'] || excelRow['Commercial Price']),
      currency: 'XAF',
      active: true
    });
  }

  // Si aucun prix spécifique n'est trouvé, utiliser un prix par défaut
  if (prices.length === 0 && excelRow['Prix'] || excelRow['Price']) {
    prices.push({
      priceType: PRICE_TYPES.RETAIL,
      price: parseFloat(excelRow['Prix'] || excelRow['Price']),
      currency: 'XAF',
      active: true
    });
  }

  return prices;
}

/**
 * Créer ou récupérer une marque
 */
async function getOrCreateBrand(brandName) {
  if (!brandName) return null;

  try {
    // Chercher la marque existante
    const searchResponse = await axios.get(`${API_BASE_URL}/products/brands?search=${encodeURIComponent(brandName)}`);
    if (searchResponse.data.brands && searchResponse.data.brands.length > 0) {
      return searchResponse.data.brands[0].id;
    }

    // Créer la marque
    const createResponse = await axios.post(`${API_BASE_URL}/products/brands`, {
      name: brandName,
      code: brandName.toUpperCase().substring(0, 10).replace(/\s/g, '_'),
      active: true
    });
    
    console.log(`  ✓ Marque créée: ${brandName}`);
    return createResponse.data.id;
  } catch (error) {
    console.error(`  ✗ Erreur lors de la création de la marque ${brandName}:`, error.message);
    return null;
  }
}

/**
 * Créer ou récupérer une ligne de produits
 */
async function getOrCreateProductLine(productLineName, brandId) {
  if (!productLineName || !brandId) return null;

  try {
    // Chercher la ligne de produits existante
    const searchResponse = await axios.get(`${API_BASE_URL}/products/product-lines?brandId=${brandId}&search=${encodeURIComponent(productLineName)}`);
    if (searchResponse.data.productLines && searchResponse.data.productLines.length > 0) {
      return searchResponse.data.productLines[0].id;
    }

    // Créer la ligne de produits
    const createResponse = await axios.post(`${API_BASE_URL}/products/product-lines`, {
      brandId: brandId,
      name: productLineName,
      code: productLineName.toUpperCase().substring(0, 10).replace(/\s/g, '_'),
      active: true
    });
    
    console.log(`  ✓ Ligne de produits créée: ${productLineName}`);
    return createResponse.data.id;
  } catch (error) {
    console.error(`  ✗ Erreur lors de la création de la ligne de produits ${productLineName}:`, error.message);
    return null;
  }
}

/**
 * Créer ou récupérer une variété de produit
 */
async function getOrCreateProductVariant(variantName, productLineId) {
  if (!variantName || !productLineId) return null;

  try {
    // Chercher la variété existante
    const searchResponse = await axios.get(`${API_BASE_URL}/products/product-variants?productLineId=${productLineId}&search=${encodeURIComponent(variantName)}`);
    if (searchResponse.data.variants && searchResponse.data.variants.length > 0) {
      return searchResponse.data.variants[0].id;
    }

    // Créer la variété
    const createResponse = await axios.post(`${API_BASE_URL}/products/product-variants`, {
      productLineId: productLineId,
      name: variantName,
      code: variantName.toUpperCase().substring(0, 10).replace(/\s/g, '_')
    });
    
    console.log(`  ✓ Variété créée: ${variantName}`);
    return createResponse.data.id;
  } catch (error) {
    console.error(`  ✗ Erreur lors de la création de la variété ${variantName}:`, error.message);
    return null;
  }
}

/**
 * Importer un produit
 */
async function importProduct(productData) {
  try {
    // Créer ou récupérer la marque
    const brandId = await getOrCreateBrand(productData.brandName);
    
    // Créer ou récupérer la ligne de produits (si marque existe)
    let productLineId = null;
    if (brandId && productData.variantName) {
      // Utiliser le nom de la variété comme ligne de produits pour l'instant
      productLineId = await getOrCreateProductLine(productData.variantName, brandId);
    }

    // Créer ou récupérer la variété (si ligne de produits existe)
    let variantId = null;
    if (productLineId) {
      variantId = await getOrCreateProductVariant(productData.variantName, productLineId);
    }

    // Créer le produit
    const createRequest = {
      sku: productData.sku,
      variantId: variantId,
      barcode: productData.barcode,
      category: productData.category,
      unit: productData.unit,
      unitPriceAmount: productData.prices.length > 0 ? productData.prices[0].price : 0,
      leadTimeDays: productData.leadTimeDays,
      safetyStockDays: productData.safetyStockDays,
      active: productData.active,
      prices: productData.prices
    };

    const response = await axios.post(`${API_BASE_URL}/products/products`, createRequest);
    console.log(`  ✓ Produit importé: ${productData.sku} - ${productData.designation}`);
    
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 409) {
      console.log(`  ⚠ Produit existe déjà: ${productData.sku}`);
    } else {
      console.error(`  ✗ Erreur lors de l'import du produit ${productData.sku}:`, error.message);
    }
    return null;
  }
}

/**
 * Fonction principale
 */
async function main() {
  console.log('=== Script d\'import des produits TANTY ERP ===\n');

  // Lire le fichier Excel
  const excelData = readExcelFile(EXCEL_FILE);
  
  if (excelData.length === 0) {
    console.log('Aucune donnée trouvée dans le fichier Excel');
    return;
  }

  console.log(`\nDébut de l'import de ${excelData.length} produits...\n`);

  let successCount = 0;
  let errorCount = 0;

  // Importer chaque produit
  for (let i = 0; i < excelData.length; i++) {
    const excelRow = excelData[i];
    const productData = mapProductData(excelRow);
    
    console.log(`[${i + 1}/${excelData.length}] Import: ${productData.sku}`);
    
    const result = await importProduct(productData);
    if (result) {
      successCount++;
    } else {
      errorCount++;
    }

    // Pause pour éviter de surcharger le serveur
    if (i < excelData.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n=== Résumé de l'import ===`);
  console.log(`Total produits: ${excelData.length}`);
  console.log(`Réussis: ${successCount}`);
  console.log(`Échoués: ${errorCount}`);
  console.log(`Taux de réussite: ${((successCount / excelData.length) * 100).toFixed(2)}%`);
}

// Exécuter le script
main().catch(error => {
  console.error('Erreur fatale:', error);
  process.exit(1);
});
