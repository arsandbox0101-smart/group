import { MenuItem, SizeOption, StoreType } from '../types';

export const TAIWAN_CITIES = [
  '台北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣',
  '台中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '台南市',
  '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '台東縣', '澎湖縣', '金門縣', '連江縣'
];

export interface ExtractedMenuData {
  storeName: string | null;
  storeType: StoreType | null;
  storeCity: string | null;
  storePhone: string | null;
  storeAddress: string | null;
  items: MenuItem[];
  cleanedRawText: string;
}

/**
 * Auto-detects store type based on store name, categories, item names, and raw text keywords.
 */
export function detectStoreType(storeName: string | null, items: MenuItem[], rawText: string): StoreType {
  const fullText = `${storeName || ''} ${rawText}`.toLowerCase();
  const name = (storeName || '').toLowerCase();

  const scores: Record<StoreType, number> = {
    '飲料': 0,
    '便當': 0,
    '甜點': 0,
    '團購商品': 0,
    '其他': 0,
  };

  // 1. Store name explicit keyword matching (+10 points)
  if (/(丹丹|丹丹漢堡)/.test(name)) {
    scores['便當'] += 15;
  }
  if (/(茶|奶茶|手搖|飲料|咖啡|拿鐵|清心|50嵐|珍煮丹|麻古|可不可|迷客夏|龜記|五桐號|再睡5分鐘|一紀|八曜|和茶|飲品|鮮奶茶|烏龍|綠茶|紅茶|青茶|水果茶|冬瓜|冰沙|果汁|連鎖飲料|水茶|茶飲|特調|星巴克|路易莎|cama|得正|大苑子|萬波|先喝道|叮哥|鶴茶樓|一芳|康青龍)/.test(name)) {
    scores['飲料'] += 10;
  }
  if (/(便當|飯|麵|排骨|雞腿|魯肉|爌肉|燒肉|快餐|自助餐|正忠|鬍鬚張|池上|小吃|食堂|餐盒|便當店|鴨肉|牛肉麵|火鍋|海南雞|燒臘|豬腳|肉燥|廣東粥|拉麵|烏龍麵|湯包|水餃|鍋貼|鐵板燒|丼|定食)/.test(name)) {
    scores['便當'] += 10;
  }
  if (/(甜點|蛋糕|泡芙|鬆餅|車輪餅|紅豆餅|豆花|冰品|雪花冰|布丁|奶酪|烘焙|甜品|仙草|芋圓|可頌|甜甜圈|馬卡龍|生乳捲|塔類|派類|手作甜點|冰淇淋|剉冰|刨冰|舒芙蕾)/.test(name)) {
    scores['甜點'] += 10;
  }
  if (/(團購|零食|特賣|生活用品|百貨|雜貨|禮盒|團媽|團購特賣|辦公室團購|乾貨|日用品|團購好物|伴手禮)/.test(name)) {
    scores['團購商品'] += 10;
  }
  if (/(麥當勞|摩斯|肯德基|漢堡|早午餐|輕食|沙拉|三明治|披薩|必勝客|達美樂|subway|潛艇堡|炸雞|鹹酥雞|蛋餅|吐司|帕尼尼)/.test(name)) {
    scores['其他'] += 8;
  }

  // 2. Menu items matching (+2 points per item match)
  items.forEach((item) => {
    const itemText = `${item.category} ${item.itemName}`.toLowerCase();

    // Drink item keywords
    if (/(茶|奶茶|珍珠|手搖|飲料|咖啡|拿鐵|烏龍|青茶|綠茶|紅茶|冬瓜|冰沙|果汁|歐蕾|鮮奶|特調|原茶|波霸|椰果|仙草|黑糖|蒟蒻|果粒|蜜茶|多多|檸檬|美式|卡布|摩卡|瑪奇朵|espresso|latte|tea|coffee|採茶|極上|穀絲|麥茶|普洱)/.test(itemText)) {
      scores['飲料'] += 2;
    }
    // Bento / Meal item keywords
    if (/(便當|飯|麵|雞腿|排骨|魯肉飯|肉燥飯|爌肉|燒肉|丼飯|定食|豬排|牛排|鐵板|快餐|湯麵|乾麵|炒飯|炒麵|魚排|雞排|羹|主餐|套餐|飯盒|湯品|小菜|滷味|肉燥|扣肉|叉燒|鴨肉|羊肉|牛肉|豬肉|豆腐|青菜|貢丸湯|蛤蜊湯)/.test(itemText)) {
      scores['便當'] += 2;
    }
    // Dessert item keywords
    if (/(甜點|蛋糕|泡芙|鬆餅|車輪餅|紅豆餅|豆花|冰淇淋|雪花冰|塔|派|生乳捲|布丁|奶酪|馬卡龍|可頌|刨冰|剉冰|甜品|芋圓|仙草|舒芙蕾|甜甜圈|戚風|提拉米蘇|千層|乳酪|巴斯克|大福|草莓塔|檸檬塔)/.test(itemText)) {
      scores['甜點'] += 2;
    }
    // Group buy item keywords
    if (/(團購|零食|特賣|生活用品|衛生紙|堅果|乾貨|團購商品|禮盒|折扣組|試吃裝|買一送一|串|箱|包|罐|大禮包|餅乾|海苔|果乾|肉乾|抽取式|洗衣精|濕紙巾)/.test(itemText)) {
      scores['團購商品'] += 2;
    }
    // Other / Fast food / Light meal item keywords
    if (/(漢堡|薯條|雞塊|蛋卷|蛋餅|吐司|沙拉|三明治|潛艇堡|披薩|帕尼尼|炸雞|麥克鷄塊|大麥克|吉事堡)/.test(itemText)) {
      scores['其他'] += 2;
    }
  });

  // 3. Raw text structural signals (+3 to +5 points)
  if (/(微糖|無糖|少糖|半糖|正常糖|微冰|去冰|少冰|溫熱|熱飲|大杯|中杯|小杯|l:|m:|容量|甜度|冰量)/.test(fullText)) {
    scores['飲料'] += 4;
  }
  if (/(便當|主餐|便當店|加辣|白飯|小菜)/.test(fullText)) {
    scores['便當'] += 2;
  }
  if (/(甜點|蛋糕|冰品|手作甜點)/.test(fullText)) {
    scores['甜點'] += 2;
  }
  if (/(團購|零食|生活用品|團購商品)/.test(fullText)) {
    scores['團購商品'] += 2;
  }

  // Determine highest scoring category
  let maxCategory: StoreType = '便當';
  let maxScore = -1;

  (Object.keys(scores) as StoreType[]).forEach((cat) => {
    if (scores[cat] > maxScore) {
      maxScore = scores[cat];
      maxCategory = cat;
    }
  });

  if (maxScore <= 0) {
    return '其他';
  }

  return maxCategory;
}

/**
 * Extracts store metadata (Name, City, Phone, Address) and parses valid menu items from raw text input.
 * Strips out store metadata / header lines so they do not become menu item rows.
 */
export function extractStoreMetadataAndItems(rawText: string): ExtractedMenuData {
  let storeName: string | null = null;
  let storeCity: string | null = null;
  let storePhone: string | null = null;
  let storeAddress: string | null = null;

  const lines = rawText.split('\n');
  const validMenuLines: string[] = [];
  const items: MenuItem[] = [];

  const phoneRegex = /(?:(?:\+?886|0)\d{1,2}[-.\s]?\d{6,8}|09\d{2}[-.\s]?\d{3}[-.\s]?\d{3}|\(0\d{1,2}\)\d{6,8})/;

  // Helper: strictly check if a string token is a valid numeric price
  const isValidPriceString = (str: string | undefined): boolean => {
    if (!str) return false;
    const s = str.trim().replace(/^\$/, '');
    // Fail if matches telephone number pattern or contains telephone dash pattern like 07-3808822 or (02)xxxx
    if (phoneRegex.test(str) || /^0\d{1,2}[-.\s]?\d+/.test(str)) return false;
    // Fail if contains address keywords like 市, 區, 鄉, 鎮, 縣, 路, 街, 段, 巷, 弄, 號, 樓
    if (/(?:市|區|鄉|鎮|縣|路|街|段|巷|弄|號|樓)/.test(str)) return false;
    // Must strictly be numeric float or integer
    return /^\d+(?:\.\d+)?$/.test(s);
  };

  lines.forEach((originalLine, index) => {
    const line = originalLine.trim();
    if (!line) return;

    let isHeaderMetadataLine = false;

    // 1. Explicit Key-Value Matches
    // e.g. 店名/店家/店家名稱/名稱: ...
    const nameMatch = line.match(/^(?:店家名稱|店名|店家|名稱)\s*[:：]\s*(.+)$/i);
    if (nameMatch) {
      if (!storeName) storeName = nameMatch[1].trim();
      isHeaderMetadataLine = true;
    }

    // e.g. 訂購電話/電話/專線/TEL: ...
    const phonePrefixMatch = line.match(/^(?:訂購電話|電話|訂購專線|專線|TEL|聯絡電話)\s*[:：]\s*(.+)$/i);
    if (phonePrefixMatch) {
      const extractedP = phonePrefixMatch[1].trim();
      if (!storePhone) storePhone = extractedP;
      isHeaderMetadataLine = true;
    }

    // e.g. 店家地址/地址/ADD/LOCATION: ...
    const addressPrefixMatch = line.match(/^(?:店家地址|地址|LOCATION|ADD)\s*[:：]\s*(.+)$/i);
    if (addressPrefixMatch) {
      const extractedA = addressPrefixMatch[1].trim();
      if (!storeAddress) storeAddress = extractedA;
      isHeaderMetadataLine = true;
    }

    // e.g. 所在縣市/縣市: ...
    const cityPrefixMatch = line.match(/^(?:所在縣市|縣市|城市)\s*[:：]\s*(.+)$/i);
    if (cityPrefixMatch) {
      const extractedC = cityPrefixMatch[1].trim();
      if (!storeCity) storeCity = extractedC;
      isHeaderMetadataLine = true;
    }

    // 2. Embedded Pattern Recognition
    const embeddedPhone = line.match(phoneRegex);
    if (embeddedPhone && !isHeaderMetadataLine) {
      if (!storePhone) {
        storePhone = embeddedPhone[0].trim();
      }
    }

    let foundCityInLine: string | null = null;
    for (const city of TAIWAN_CITIES) {
      if (line.includes(city)) {
        foundCityInLine = city;
        if (!storeCity) storeCity = city;
        break;
      }
    }

    const addressMatch = line.match(/(?:[^\s,，\t]*?(?:市|縣)[^\s,，\t]*?(?:區|鄉|鎮|市)[^\s,，\t]*?(?:路|街|段|巷|弄)[0-9-]*號?|(?:[^\s,，\t]*?(?:區|鄉|鎮|市)[^\s,，\t]*?(?:路|街|段|巷|弄)[0-9-]*號?))/);
    if (addressMatch && !isHeaderMetadataLine) {
      if (!storeAddress) {
        storeAddress = addressMatch[0].trim();
      }
    }

    // 3. Composite Header Line Detection (e.g. "八曜和茶 (高雄建工店),高雄市三民區建工路424號,07-3808822")
    if (embeddedPhone || addressMatch || (foundCityInLine && (line.includes('店') || line.includes('號') || line.includes('街')))) {
      let cleanLineForName = line;
      if (embeddedPhone) cleanLineForName = cleanLineForName.replace(embeddedPhone[0], '');
      if (addressMatch) cleanLineForName = cleanLineForName.replace(addressMatch[0], '');
      cleanLineForName = cleanLineForName.replace(/^(?:店家名稱|店名|店家|地址|電話|訂購電話|訂購專線|專線|所在縣市|縣市)\s*[:：]?/gi, '');
      cleanLineForName = cleanLineForName.replace(/[,，\t]/g, ' ').replace(/\s+/g, ' ').trim();

      if (cleanLineForName && !storeName && cleanLineForName.length < 35) {
        storeName = cleanLineForName;
      }

      const parts = line.split(/[\t,]/).map(s => s.trim()).filter(Boolean);
      const is3PartMenu = parts.length >= 3 && isValidPriceString(parts[2]);
      const is2PartMenu = parts.length === 2 && isValidPriceString(parts[1]) && parts[0].length < 15 && !phoneRegex.test(parts[0]) && !/(?:市|區|路|街|號)/.test(parts[0]);

      if (!is3PartMenu && !is2PartMenu) {
        isHeaderMetadataLine = true;
      }
    }

    // 4. First line pure store header check or line without valid price column
    if (index === 0 && !isHeaderMetadataLine) {
      const parts = line.split(/[\t,]/).map(s => s.trim()).filter(Boolean);
      const is3PartMenu = parts.length >= 3 && isValidPriceString(parts[2]);
      const is2PartMenu = parts.length === 2 && isValidPriceString(parts[1]);

      if (!is3PartMenu && !is2PartMenu) {
        if (!storeName) {
          let nameCandidate = line.split(/[\t,]/)[0];
          nameCandidate = nameCandidate.replace(/^(?:店家名稱|店名|店家)\s*[:：]?/i, '').trim();
          if (nameCandidate) storeName = nameCandidate;
        }
        isHeaderMetadataLine = true;
      }
    }

    if (isHeaderMetadataLine) {
      return; // Skip adding metadata line to items
    }

    // 5. Try parsing as a menu item line
    const parts = line.split(/[\t,]/).map((s) => s.trim()).filter(Boolean);
    let itemParsed = false;

    if (parts.length >= 3) {
      const category = parts[0];
      const itemName = parts[1];
      const priceStr = parts[2];

      const isMetadataPart = phoneRegex.test(category) || phoneRegex.test(itemName) || /(?:市|區|鄉|鎮|縣|路|街|段|巷|弄|號|訂購電話|店家地址|營業時間)/.test(itemName) || /(?:訂購電話|店家地址|營業時間)/.test(category);

      if (!isMetadataPart && isValidPriceString(priceStr)) {
        const price = parseFloat(priceStr.replace(/^\$/, ''));
        let sizes: SizeOption[] | undefined = undefined;

        if (parts.length >= 4 && parts[3]) {
          const sizePairs = parts[3].split('|');
          const tempSizes: SizeOption[] = [];
          sizePairs.forEach((pair) => {
            const [sName, sPrice] = pair.split(':');
            if (sName && sPrice && isValidPriceString(sPrice)) {
              tempSizes.push({ name: sName.trim(), price: parseFloat(sPrice.trim().replace(/^\$/, '')) });
            }
          });
          if (tempSizes.length > 0) sizes = tempSizes;
        }

        items.push({ category, itemName, price, sizes });
        validMenuLines.push(originalLine);
        itemParsed = true;
      }
    } else if (parts.length === 2) {
      const itemName = parts[0];
      const priceStr = parts[1];

      const isMetadataPart = phoneRegex.test(itemName) || /(?:市|區|鄉|鎮|縣|路|街|段|巷|弄|號|訂購電話|店家地址|營業時間)/.test(itemName);

      if (!isMetadataPart && isValidPriceString(priceStr)) {
        const price = parseFloat(priceStr.replace(/^\$/, ''));
        items.push({ category: '一般', itemName, price });
        validMenuLines.push(originalLine);
        itemParsed = true;
      }
    }

    if (!itemParsed) {
      if (line.includes('電話') || line.includes('地址') || line.includes('營業時間') || phoneRegex.test(line) || /(?:市|區|路|街|號)/.test(line)) {
        // Skip metadata noise line
      } else {
        validMenuLines.push(originalLine);
      }
    }
  });

  if (!storeCity && storeAddress) {
    for (const city of TAIWAN_CITIES) {
      if (storeAddress.includes(city)) {
        storeCity = city;
        break;
      }
    }
  }

  const computedStoreType = detectStoreType(storeName, items, rawText);

  return {
    storeName,
    storeType: computedStoreType,
    storeCity,
    storePhone,
    storeAddress,
    items,
    cleanedRawText: validMenuLines.join('\n')
  };
}
