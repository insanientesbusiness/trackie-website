/* TRACKIE — STORE SETTINGS. Edit only the values between the braces (keep quotes and commas).
   order.php reads this same file to calculate order totals, so prices stay identical on site and server. */
window.TRACKIE_CONFIG = {
  "currency": "EUR",
  "locale": "de-DE",
  "previewMode": true,

  "product": {
    "id": "trackie-cover",
    "name": "Trackie® Smart Luggage Cover",
    "price": 39.90,
    "comparePrice": null,
    "description": "A stretch-fit, water-resistant cover that protects your suitcase from scratches, dust and rain — with a hidden pocket for your Bluetooth tracker and a zip side pocket for essentials.",
    "colors": [
      { "name": "Black",  "hex": "#0B0D12" },
      { "name": "Beige",  "hex": "#DCC7A1" },
      { "name": "Blue",   "hex": "#1C2D5C" },
      { "name": "Pink",   "hex": "#EAC7C0" },
      { "name": "Purple", "hex": "#D9D5E6" },
      { "name": "Brown",  "hex": "#8D5A3D" },
      { "name": "Grey",   "hex": "#9D9C9D" },
      { "name": "Green",  "hex": "#7C7F57" },
      { "name": "Red",    "hex": "#C2333F" },
      { "name": "Yellow", "hex": "#E6C35C" }
    ],
    "sizes": [
      { "name": "S",  "fits": "18–20\"", "cm": "45–55 cm" },
      { "name": "M",  "fits": "22–24\"", "cm": "55–65 cm" },
      { "name": "L",  "fits": "26–28\"", "cm": "65–75 cm" },
      { "name": "XL", "fits": "29–32\"", "cm": "75–82 cm" }
    ],
    "defaultSize": "M",
    "soldOut": []
  },

  "shipping": {
    "countries": ["Bosnia and Herzegovina", "Croatia", "Serbia", "Montenegro", "Slovenia", "North Macedonia", "Austria", "Germany"],
    "price": 5.00,
    "freeOver": 60,
    "codFee": 0
  },

  "payments": {
    "cod":  { "enabled": true,  "label": "Cash on delivery", "note": "Pay the courier when your package arrives." },
    "bank": { "enabled": true,  "label": "Bank transfer", "note": "We email you our bank details. Your order ships once payment arrives." },
    "card": { "enabled": false, "label": "Card payment", "note": "Visa, Mastercard — secure payment page.", "url": "" }
  },

  "bank": {
    "recipient": "TRACKIE (your company name)",
    "iban": "BA39 0000 0000 0000 0000",
    "bankName": "Your bank",
    "swift": ""
  },

  "contactEmail": "info@trackieofficial.com",
  "orderEndpoint": "order.php",
  "newsletterEndpoint": "subscribe.php",
  "social": { "instagram": "", "tiktok": "", "facebook": "" },
  "policies": { "shipping": "", "refund": "", "privacy": "", "terms": "" }
};
