/**
 * Cloudflare Pages Functions API: /api/kwitansi
 * Serverless D1 SQL Endpoint for Kwitansi Generator
 */

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM kwitansi ORDER BY created_at DESC"
    ).all();

    // Map DB fields back to client format
    const history = results.map(row => ({
      id: row.id,
      noKwitansi: row.no_kwitansi,
      tanggal: row.tanggal,
      namaJamaah: row.nama_jamaah,
      noWa: row.no_wa,
      paket: row.paket,
      program: row.program,
      kamar: row.kamar,
      theme: row.theme,
      headerBrand: row.header_brand,
      headerSub: row.header_sub,
      headerPpiu: row.header_ppiu,
      headerPihk: row.header_pihk,
      headerAlamat: row.header_alamat,
      headerKontak: row.header_kontak,
      headerIg: row.header_ig,
      headerTg: row.header_tg,
      logoDataUrl: row.logo_data_url,
      ttdKasirNama: row.ttd_kasir_nama,
      ttdKasirDataUrl: row.ttd_kasir_data_url,
      stempelDataUrl: row.stempel_data_url,
      paxDewasa: row.pax_dewasa,
      hargaDewasa: row.harga_dewasa,
      paxBayi: row.pax_bayi,
      hargaBayi: row.harga_bayi,
      biayaTambahan: row.biaya_tambahan,
      totalHarga: row.total_harga,
      nominalBayar: row.nominal_bayar,
      kekurangan: row.kekurangan,
      jenisBayar: row.jenis_bayar,
      metode: row.metode,
      catatan: row.catatan,
      status: row.status,
      checkboxes: row.checkboxes ? JSON.parse(row.checkboxes) : [],
      customFas: row.custom_fas ? JSON.parse(row.custom_fas) : [],
      timestamp: row.created_at
    }));

    return new Response(JSON.stringify(history), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const data = await request.json();

    const id = data.id || 'KW-' + Date.now();
    const checkboxesJson = JSON.stringify(data.checkboxes || []);
    const customFasJson = JSON.stringify(data.customFas || []);

    await env.DB.prepare(`
      INSERT INTO kwitansi (
        id, no_kwitansi, tanggal, nama_jamaah, no_wa, paket, program, kamar, theme,
        header_brand, header_sub, header_ppiu, header_pihk, header_alamat, header_kontak, header_ig, header_tg,
        logo_data_url, ttd_kasir_nama, ttd_kasir_data_url, stempel_data_url,
        pax_dewasa, harga_dewasa, pax_bayi, harga_bayi, biaya_tambahan,
        total_harga, nominal_bayar, kekurangan, jenis_bayar, metode, catatan, status,
        checkboxes, custom_fas
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?
      ) ON CONFLICT(id) DO UPDATE SET
        no_kwitansi = excluded.no_kwitansi,
        tanggal = excluded.tanggal,
        nama_jamaah = excluded.nama_jamaah,
        no_wa = excluded.no_wa,
        paket = excluded.paket,
        program = excluded.program,
        kamar = excluded.kamar,
        theme = excluded.theme,
        header_brand = excluded.header_brand,
        header_sub = excluded.header_sub,
        header_ppiu = excluded.header_ppiu,
        header_pihk = excluded.header_pihk,
        header_alamat = excluded.header_alamat,
        header_kontak = excluded.header_kontak,
        header_ig = excluded.header_ig,
        header_tg = excluded.header_tg,
        logo_data_url = excluded.logo_data_url,
        ttd_kasir_nama = excluded.ttd_kasir_nama,
        ttd_kasir_data_url = excluded.ttd_kasir_data_url,
        stempel_data_url = excluded.stempel_data_url,
        pax_dewasa = excluded.pax_dewasa,
        harga_dewasa = excluded.harga_dewasa,
        pax_bayi = excluded.pax_bayi,
        harga_bayi = excluded.harga_bayi,
        biaya_tambahan = excluded.biaya_tambahan,
        total_harga = excluded.total_harga,
        nominal_bayar = excluded.nominal_bayar,
        kekurangan = excluded.kekurangan,
        jenis_bayar = excluded.jenis_bayar,
        metode = excluded.metode,
        catatan = excluded.catatan,
        status = excluded.status,
        checkboxes = excluded.checkboxes,
        custom_fas = excluded.custom_fas
    `).bind(
      id, data.noKwitansi, data.tanggal, data.namaJamaah, data.noWa, data.paket, data.program, data.kamar, data.theme,
      data.headerBrand, data.headerSub, data.headerPpiu, data.headerPihk, data.headerAlamat, data.headerKontak, data.headerIg, data.headerTg,
      data.logoDataUrl, data.ttdKasirNama, data.ttdKasirDataUrl, data.stempelDataUrl,
      data.paxDewasa, data.hargaDewasa, data.paxBayi, data.hargaBayi, data.biayaTambahan,
      data.totalHarga, data.nominalBayar, data.kekurangan, data.jenisBayar, data.metode, data.catatan, data.status,
      checkboxesJson, customFasJson
    ).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
