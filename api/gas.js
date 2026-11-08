// Vercel serverless proxy: browser calls same-origin /api/gas, avoiding GAS CORS redirects.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method not allowed" });
  const endpoint = process.env.GAS_WEB_APP_URL;
  if (!endpoint) return res.status(500).json({ ok:false, error:"GAS_WEB_APP_URL belum diatur di Vercel." });
  try {
    const upstream = await fetch(endpoint, {
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(req.body || {})
    });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("Respons Apps Script tidak valid. Periksa URL dan deployment Web App."); }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ok:false,error:e.message || "Gagal menghubungi Google Apps Script."});
  }
}
