export default {
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(JSON.stringify({
        status: "I am Red - MULTI BRAIN V13",
        version: "v13-multi-brain-own-brain",
        brains: {
          workers_ai: env.AI ? "READY - Llama 3.3 70B inside Cloudflare, no key" : "MISSING - need wrangler.toml [ai] binding",
          groq: env.GROQ_API_KEY ? "READY - gpt-oss-120b" : "MISSING",
          gemini: env.GEMINI_API_KEY ? "READY - Gemini 2.5 Flash" : "MISSING - add free key for extra brain",
          openrouter: env.OPENROUTER_API_KEY ? "READY" : "MISSING - optional"
        },
        fallback: "Smart local brain - specific, not hello loop",
        note: "Multi-brain: if one provider dies, next takes over. Red never dies."
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (url.pathname === "/red" && request.method === "POST") {
      try {
        const body = await request.json().catch(() => ({}));
        const query = (body.query || "").toString().slice(0, 2000).trim();
        const profile = body.profile || {};
        const history = Array.isArray(body.history) ? body.history : [];
        const type = (profile.type || "O+").trim() || "O+";
        const name = (profile.name || "Tshire").trim() || "Tshire";
        const firstName = name.split(" ")[0] || "Tshire";
        const age = profile.age || "";
        const allergy = profile.allergy || "none";
        const lower = query.toLowerCase();
        if (!query) return new Response(JSON.stringify({ error: "empty_query", answer: null }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

        const FOOD_DB = {
          "O": "O: High stomach acid, needs heme iron. Best: Lamb 500g R189, Salmon 200g R129, Beef, Eggs 6 R42.99, Spinach R29, Beetroot R24.99, Broccoli, Berries, Plums. Avoid: Wheat, Corn, Kidney beans (lectins = bloat).",
          "A": "A: Lower acid, calm digestion. Best: Tofu 300g R39.99, Spinach R29, Lentils, Broccoli, Salmon R129, Berries, Avocado R34.99. Avoid: Heavy red meat.",
          "B": "B: Balanced, dairy tolerant. Best: Eggs R42.99, Yogurt 500g R44.99, Lamb R189, Salmon R129, Oats, Greens. Avoid: Chicken, Corn, Peanuts (lectins).",
          "AB": "AB: Mix A+B, sensitive. Best: Tofu R39.99, Salmon R129, Eggs R42.99, Spinach R29, Yogurt R44.99, Kale. Avoid: Red meat excess."
        };
        const tKey = type.toUpperCase().replace(/[+-]/g,'').charAt(0);
        const foodInfo = FOOD_DB[tKey] || FOOD_DB["O"];
        const shop = "SHOP mytypegroup.com: Eggs R42.99, Spinach R29.99, Lamb R189.99, Salmon R129.99, Tofu R39.99, Beetroot R24.99, Bread R35.99, Fruits Mix R49.99";

        const systemPrompt = `You are Red. Real AI assistant like Meta AI, with your own brain. Warm, human, curious, empathetic.

User: ${firstName}, blood type ${type}, age ${age}, allergy: ${allergy}.

YOUR BRAIN:
- MEMORY: Remember last 20 msgs. If user said "pap made me tired" or "spinach bloated me", remember and mention it.
- EMPATHY: If tired/dizzy/stressed/BP high, be empathetic first.
- REASONING: Explain WHY with mechanisms: lectins, stomach acid, iron + Vit C, nitric oxide, insulin crash, salt + BP, dehydration.
- LEARNING: Adapt. Don't repeat same advice if they said it didn't work.
- CURIOSITY: Ask 1-2 SPECIFIC follow-ups BASED ON THEIR EXACT WORDS:
  - "I ate pap only" -> How much pap, with what, how did it feel after, when, sleep, water?
  - "tired/dizzy" -> Hours sleep, water litres, what ate today, how long, stress?
  - "High BP 150/95" -> Exact readings, salt today, water, stress, medication, chest pain/headache, how long?
  - "Recommend food / Should I eat fruits / Health care" -> What ate today, symptoms after foods, sleep, goal?
  - "gym / creatine / salt / juice / bread" -> Water, training frequency, how does it feel after, BP/kidney, what else ate?
- CONTEXT: Connect sleep + water + food + symptoms.
- DECISION: Specific TODAY + THIS WEEK plan for ${type}.

FIRST MESSAGE EVER ONLY: "Hello ${firstName}, nice to see you. I am Red. How's your day going so far? Have you been feeling energized and focused, or is there something that's been bothering you lately? Maybe we can start with how you've been sleeping and if you've noticed any changes in your energy levels?"
After that NEVER repeat greeting.

BLOOD TYPE: ${foodInfo}
SHOP: ${shop}
RULES: Info only, not medical diagnosis. BP >140/90 hours, chest pain, dizziness >24h -> clinic. Be concise but complete, like Meta AI. Never give generic canned answer.`;

        let messages = [{ role: "system", content: systemPrompt }];
        for (const h of history.slice(-20)) {
          if (h && h.role && h.content) messages.push({ role: h.role === "assistant" ? "assistant" : "user", content: h.content.toString().slice(0, 1000) });
        }
        messages.push({ role: "user", content: query });

        let answerText = "";
        let modelUsed = "";

        // BRAIN 1: Workers AI - OWN BRAIN inside Cloudflare, no external key, most reliable
        if (!answerText && env.AI) {
          try {
            const r = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages, max_tokens: 1200, temperature: 0.85, top_p: 0.92 });
            const txt = r.response || r.text || "";
            if (txt && txt.length > 20) { answerText = txt; modelUsed = "multi-brain/workers-ai/llama-3.3-70b-own-brain"; }
          } catch (e) {}
        }

        // BRAIN 2: Gemini 2.5 Flash - FREE, stable, like Meta AI
        if (!answerText && env.GEMINI_API_KEY) {
          try {
            const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt + "\n\nHistory:\n" + history.slice(-10).map(h=>`${h.role}: ${h.content}`).join("\n") + `\n\nUser: ${query}` }] }],
                generationConfig: { temperature: 0.85, maxOutputTokens: 1200 }
              })
            });
            if (gemRes.ok) {
              const gData = await gemRes.json();
              const txt = gData.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (txt && txt.length > 20) { answerText = txt; modelUsed = "multi-brain/gemini-2.0-flash"; }
            }
          } catch (e) {}
        }

        // BRAIN 3: Groq gpt-oss-120b - works 2026
        if (!answerText && env.GROQ_API_KEY) {
          const groqModels = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3-32b"];
          for (const gModel of groqModels) {
            try {
              const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: gModel, messages, max_tokens: 1200, temperature: 0.85, top_p: 0.92 })
              });
              if (res.ok) {
                const data = await res.json();
                const txt = data.choices?.[0]?.message?.content || "";
                if (txt && txt.length > 20) { answerText = txt; modelUsed = `multi-brain/groq/${gModel}`; break; }
              }
            } catch (e) { continue; }
          }
        }

        // BRAIN 4: OpenRouter free - if you add key later
        if (!answerText && env.OPENROUTER_API_KEY) {
          try {
            const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://mytypegroup.com", "X-Title": "MyType Red" },
              body: JSON.stringify({ model: "meta-llama/llama-3.3-70b-instruct:free", messages, max_tokens: 1200, temperature: 0.85 })
            });
            if (orRes.ok) {
              const oData = await orRes.json();
              const txt = oData.choices?.[0]?.message?.content || "";
              if (txt && txt.length > 20) { answerText = txt; modelUsed = "multi-brain/openrouter/llama-3.3-70b-free"; }
            }
          } catch (e) {}
        }

        // SMART LOCAL BRAIN - last resort, specific not generic
        if (!answerText) {
          let specific = "";
          if (lower.includes("juice")) specific = `Good question ${firstName}! Juice for ${type}:\n\nOrange 150ml WITH iron meal (eggs/spinach) - Vit C boosts iron 2x. Beetroot juice 2-3x week - nitric oxide helps blood flow if dizzy/tired. Beetroot R24.99.\n\n${foodInfo}\n\nFollow-up: You said "${query}" - how much juice? With what meal? Sleep/water today?`;
          else if (lower.includes("pap")) specific = `Hey ${firstName}, you said "${query}" for ${type} - I hear you.\n\nPap alone = simple carbs. For ${type}, pap alone can crash energy - low protein + low iron, sugar spike then crash. That's why tired.\n\n${foodInfo}\n\nTODAY: Pap + protein (eggs/lamb/tofu) + greens + water 2L, not pap alone.\n\nFollow-up: How much pap? With what? How long after tired hit? Sleep? Water?`;
          else if (lower.includes("spinach") || lower.includes("salmon") || lower.includes("bread") || lower.includes("fruit") || lower.includes("recommend") || lower.includes("food") || lower.includes("eat") || lower.includes("health") || lower.includes("creatine") || lower.includes("salt") || lower.includes("gym")) specific = `Hey ${firstName}, you said "${query}" for ${type}.\n\n${foodInfo}\n\nTODAY: ${tKey==='O'?'Eggs + Spinach + Orange 150ml':tKey==='A'?'Tofu + Broccoli + Berries':'Eggs + Yogurt + Greens'}, water 2L. THIS WEEK: Rotate 3 proteins + beetroot 2x.\n\nFollow-up: What ate today? Symptoms after - tired/bloated/dizzy? Sleep hours? Goal?`;
          else if (lower.includes("tired") || lower.includes("dizzy") || lower.includes("sleep") || lower.includes("bp") || lower.includes("pressure")) specific = `${firstName}, I hear you - tired/dizzy/BP for ${type}.\n\n${foodInfo}\n\nBrain check: Sleep hours? Water litres? What ate today? Salt? Stress? For ${type}, low iron + dehydration drains energy.\n\nPlan: Iron food + Vit C, water 2L, early sleep. BP >140/90 hours or chest pain -> clinic.\n\nTell me: Readings? How long?`;
          else specific = `Hey ${firstName}, you said "${query}" for ${type}.\n\n${foodInfo}\n\nTell me more: How did you feel after? What else ate today? Sleep hours? I'm learning your pattern.`;
          answerText = specific;
          modelUsed = "smart-local-brain-offline-specific";
        }

        return new Response(JSON.stringify({
          answer: answerText,
          sources: ["mytype-nutrition", "SANBS 2023", modelUsed],
          disclaimer: "I'm Red — info only, not medical diagnosis. BP >140/90 hours, chest pain, dizziness >24h -> clinic.",
          chips: [`My plan for ${type} today?`, `Why am I tired?`, `Best juice for ${type}?`],
          type, query, brain: "v13-multi-brain", model: modelUsed
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: "server_error", answer: null, message: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ error: "Use POST /red" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
  }
};
