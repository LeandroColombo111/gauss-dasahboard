# 📊 Gauss Campaign Analyzer

A React-based dashboard for analyzing **Meta Ads campaign performance** using Gaussian distribution (z-scores).  
It helps media buyers quickly detect **outliers**, assess **campaign profitability**, and get **actionable recommendations**.

---

## ✨ Features

- 📈 **Metrics supported**
  - CPM (Cost per Mille)
  - CPC (Cost per Click)
  - CTR (Click-through Rate)
  - ROAS (Return on Ad Spend)
  - Profit (Revenue – Spend)
  - CPA (Cost per Action)

- ⚡ **Automatic filtering**
  - Only campaigns with names starting with `[ON]`  
  - Only campaigns with **results > 0**

- 🧠 **Classification engine**
  - Gaussian z-score analysis for each metric
  - Tags campaigns as:  
    - 📈 Very High  
    - 📉 Very Low  
    - ✅ Normal  

- 🛠 **Recommendations**
  - 🔼 Scale budget  
  - ✅ Keep running  
  - 🔽 Review / Pause  

- 💾 **Export results** to CSV with insights and recommendations  

---

## 🖥️ Demo

1. Upload your exported **Meta Ads CSV** file.  
2. The dashboard processes it and displays:  
   - Key stats per campaign  
   - Gaussian classification  
   - Suggested action  
3. Adjust **sigma (z-threshold)** to change sensitivity.  

---

## 📂 Required CSV Columns

The following fields must exist in your exported Meta CSV:  

- `Campaign name`  
- `Amount spent (USD)`  
- `Impressions`  
- `Clicks (all)`  
- `CTR (link click-through rate)` **or** `CTR (all)`  
- `Purchases conversion value`  
- (Optional) `CPC (cost per link click) (USD)`

⚠️ Only `[ON]` campaigns with results > 0 will be analyzed.

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/gauss-dashboard.git
cd gauss-dashboard
