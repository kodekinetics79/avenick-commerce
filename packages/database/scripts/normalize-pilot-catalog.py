from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
P = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": M, "r": R}
PKG = {"p": P}

SELLER_KEYS = {
    "Mennekes": "mennekes",
    "Plymouth": "plymouth",
    "Eaton": "eaton",
    "BG Nexus": "bg-nexus",
    "3M": "3m",
}


def col_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref).group(0)
    result = 0
    for char in letters:
        result = result * 26 + ord(char) - 64
    return result - 1


def normalized_header(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def clean(value: object):
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.upper() in {"-", "N/A", "#N/A", "NONE"}:
        return None
    return text


def number(value: object):
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    if result != result or result in {float("inf"), float("-inf")}:
        return None
    return result


def safe_id(value: object) -> str:
    text = clean(value) or ""
    text = re.sub(r"[^A-Za-z0-9._-]+", "-", text).strip("-.")
    return text[:80]


def read_workbook(path: Path):
    with ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared.append("".join(node.text or "" for node in item.iter(f"{{{M}}}t")))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {
            node.attrib["Id"]: node.attrib["Target"]
            for node in relationships.findall("p:Relationship", PKG)
        }

        for sheet in workbook.find("m:sheets", NS):
            name = sheet.attrib["name"]
            if name not in SELLER_KEYS:
                continue
            target = targets[sheet.attrib[f"{{{R}}}id"]]
            xml_path = target if target.startswith("xl/") else f"xl/{target.lstrip('/')}"
            root = ET.fromstring(archive.read(xml_path))
            rows = root.findall(".//m:sheetData/m:row", NS)
            header_row_number = 3 if name == "Mennekes" else 1

            def cells(row):
                values = {}
                for cell in row.findall("m:c", NS):
                    value_node = cell.find("m:v", NS)
                    inline = cell.find("m:is", NS)
                    value = None
                    if value_node is not None:
                        value = value_node.text
                        if cell.attrib.get("t") == "s" and value is not None:
                            value = shared[int(value)]
                    elif inline is not None:
                        value = "".join(node.text or "" for node in inline.iter(f"{{{M}}}t"))
                    values[col_index(cell.attrib["r"])] = value
                return values

            header_values = cells(next(row for row in rows if int(row.attrib["r"]) == header_row_number))
            headers = {index: normalized_header(value) for index, value in header_values.items()}
            for row in rows:
                row_number = int(row.attrib["r"])
                if row_number <= header_row_number:
                    continue
                values = cells(row)
                mapped = {headers[index]: value for index, value in values.items() if index in headers}
                if clean(mapped.get("s no")) is None:
                    continue
                yield name, row_number, mapped


def get(row: dict, *names: str):
    for name in names:
        value = row.get(normalized_header(name))
        if clean(value) is not None:
            return value
    return None


def archive_assets(path: Path):
    by_key = defaultdict(list)
    with ZipFile(path) as archive:
        for full_name in archive.namelist():
            if full_name.endswith("/"):
                continue
            filename = Path(full_name).name
            stem = Path(filename).stem
            key = re.sub(r"(?:_en|-[0-9]+)$", "", stem, flags=re.IGNORECASE).lower()
            by_key[key].append(filename)
    return by_key


def main():
    if len(sys.argv) != 5:
        raise SystemExit("usage: normalize WORKBOOK MENNEKES_ZIP THREE_M_ZIP OUTPUT_JSON")
    workbook, mennekes_zip, three_m_zip, output = map(Path, sys.argv[1:])
    asset_indexes = {
        "mennekes": archive_assets(mennekes_zip),
        "3m": archive_assets(three_m_zip),
    }
    records = []
    used_skus = set()
    for sheet, source_row, row in read_workbook(workbook):
        seller_key = SELLER_KEYS[sheet]
        part_item = get(row, "Part Number (Item Number)", "Cat.-no.")
        part_number = get(row, "Part Number")
        external_item = get(row, "External Customer Item Number")
        erp_code = get(row, "ERP Code")
        identity = erp_code or (external_item if seller_key == "3m" else None) or part_number or part_item or source_row
        sku_base = f"PILOT-{seller_key.upper()}-{safe_id(identity)}"
        sku = sku_base
        if sku in used_skus:
            sku = f"{sku_base}-R{source_row}"
        if sku in used_skus:
            raise ValueError(f"duplicate normalized SKU {sku}")
        used_skus.add(sku)

        product_name = clean(get(row, "Product Name"))
        description = clean(get(row, "Product Description"))
        filters = clean(get(row, "Filter Elements"))
        if not product_name:
            product_name = description or filters or f"{sheet} product {identity}"

        brand = clean(get(row, "Brand"))
        manufacturer = clean(get(row, "Manufacturer"))
        if seller_key == "bg-nexus":
            brand = "BG Nexus"
        elif not brand:
            brand = sheet

        sales_price = None if seller_key == "eaton" else number(get(row, "Unit Prices SAR", "Unit Prices SAR (Excl VAT)"))
        purchase_currency = {"mennekes": "EUR", "plymouth": "EUR", "eaton": "USD", "bg-nexus": "EUR", "3m": "SAR"}[seller_key]
        purchase_price = number(get(row, "Purchase Price (Euro)", "Purchase Price (USD)", "Purchase Price (SAR)"))

        match_key = None
        if seller_key == "mennekes":
            match_key = safe_id(part_item or part_number).lower()
        elif seller_key == "3m":
            match_key = safe_id(external_item or erp_code).lower()
        filenames = asset_indexes.get(seller_key, {}).get(match_key or "", [])
        images = sorted(name for name in filenames if Path(name).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})
        documents = sorted(name for name in filenames if Path(name).suffix.lower() == ".pdf")

        record = {
            "sourceSheet": sheet,
            "sourceRow": source_row,
            "sellerKey": seller_key,
            "brand": brand,
            "manufacturer": manufacturer,
            "family": clean(get(row, "Product Family Name")),
            "subcategory": clean(get(row, "Product Sub")),
            "name": product_name,
            "description": description,
            "partNumberItem": clean(part_item),
            "partNumber": clean(part_number),
            "externalItemNumber": clean(external_item),
            "filterElements": filters,
            "erpCode": clean(erp_code),
            "sku": sku,
            "purchasePrice": purchase_price,
            "purchaseCurrency": purchase_currency if purchase_price else None,
            "purchaseLandedCost": number(get(row, "Purchase Landed Cost")),
            "unitPriceSAR": sales_price if sales_price and sales_price > 0 else None,
            "perCarton": number(get(row, "Per Carton", "Per Case")),
            "perPallet": number(get(row, "Per Pallet")),
            "stockAvailable": number(get(row, "Stock Available")),
            "uom": clean(get(row, "UOM")),
            "safetyStock": number(get(row, "Safety Stock")),
            "moqSales": number(get(row, "MOQ Sales", "MOQ")),
            "moqPurchase": number(get(row, "MOQ Purchase")),
            "maxVolumeLeadTime": clean(get(row, "Maximum Voulme Quantity Lead Time")),
            "deliveryLeadTime": clean(get(row, "Delivery Lead Time")),
            "hsCode": clean(get(row, "HS Code")),
            "incoterms": clean(get(row, "Inco Terms")),
            "dimensionsCm": {
                "length": number(get(row, "Length (CM)")),
                "width": number(get(row, "Width (CM)")),
                "height": number(get(row, "Height (CM)")),
            },
            "netWeightKg": number(get(row, "Net Weight (KG)")),
            "grossWeightKg": number(get(row, "Gross Weight (KG)")),
            "cbm": number(get(row, "CBM")),
            "priceValidity": clean(get(row, "Price Validity")),
            "vendorCode": clean(get(row, "Vendor Code")),
            "vendorLegalName": clean(get(row, "Preferred Vendor Legal Name")),
            "productGroup": clean(get(row, "Product Group")),
            "assetKey": match_key,
            "assets": {"images": images, "documents": documents},
        }
        if not any(record["dimensionsCm"].values()):
            record["dimensionsCm"] = None
        records.append(record)

    result = {
        "version": 1,
        "generatedFrom": workbook.name,
        "purpose": "Protected Avenick pilot import; generated locally and excluded from Git",
        "sellerKeys": list(SELLER_KEYS.values()),
        "records": records,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    counts = Counter(record["sellerKey"] for record in records)
    print(json.dumps({
        "rows": len(records),
        "sellerCounts": counts,
        "verifiedPriceRows": sum(1 for record in records if record["unitPriceSAR"]),
        "noPriceRows": sum(1 for record in records if not record["unitPriceSAR"]),
        "sourceStockRows": sum(1 for record in records if record["stockAvailable"] is not None),
        "mediaMappedRows": sum(1 for record in records if record["assets"]["images"] or record["assets"]["documents"]),
        "imageFilesMapped": sum(len(record["assets"]["images"]) for record in records),
        "documentFilesMapped": sum(len(record["assets"]["documents"]) for record in records),
        "outputBytes": output.stat().st_size,
    }, indent=2, default=dict))


if __name__ == "__main__":
    main()

