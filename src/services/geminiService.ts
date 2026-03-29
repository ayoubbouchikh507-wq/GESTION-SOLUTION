import { GoogleGenAI } from "@google/genai";
import { Product, Sale } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getAIInsights = async (
  prompt: string,
  data: { products: Product[]; sales: Sale[] }
) => {
  try {
    // Calculate Top Selling Products
    const productSales: Record<string, number> = {};
    data.sales.forEach(sale => {
      sale.items.forEach(item => {
        productSales[item.productName] = (productSales[item.productName] || 0) + item.quantity;
      });
    });
    const topProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, qty]) => `${name} (${qty} قطعة)`);

    // Calculate Peak Sales Periods (by day of week)
    const daySales: Record<string, number> = {};
    data.sales.forEach(sale => {
      const day = new Date(sale.date).toLocaleDateString('ar-SA', { weekday: 'long' });
      daySales[day] = (daySales[day] || 0) + sale.totalAmount;
    });
    const peakDays = Object.entries(daySales)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([day, total]) => `${day} (${total.toLocaleString()} ر.س)`);

    const context = `
      أنت محلل أعمال خبير لنظام إدارة المبيعات والمخزون.
      ملخص البيانات الحالية:
      - إجمالي المنتجات: ${data.products.length}
      - إجمالي المبيعات: ${data.sales.length}
      - المنتجات الأكثر مبيعاً: ${topProducts.join(', ')}
      - أيام الذروة في المبيعات: ${peakDays.join(', ')}

      بيانات تفصيلية:
      - المنتجات: ${JSON.stringify(data.products.slice(0, 20))}
      - المبيعات الأخيرة: ${JSON.stringify(data.sales.slice(0, 10))}

      سؤال المستخدم: ${prompt}

      يرجى تقديم رد مفصل واحترافي باللغة العربية.
      يجب أن يتضمن الرد:
      1. إجابة مباشرة على سؤال المستخدم.
      2. تحليل لاتجاهات المبيعات (المنتجات الأكثر مبيعاً وفترات الذروة).
      3. توصيات لإدارة المخزون أو استراتيجيات المبيعات بناءً على البيانات.
      استخدم تنسيق Markdown لجعل الرد منظماً وسهل القراءة.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: context,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return "عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. يرجى المحاولة لاحقاً.";
  }
};
