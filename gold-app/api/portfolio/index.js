
import { supabase } from '../../lib/supabase'

function monthsBetween(d1, d2) {
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
}

export default async function handler(req,res){
  const user_id = req.query.user_id

  if(req.method === 'GET'){
    const { data: rows } = await supabase.from('gold_portfolio').select('*').eq('user_id', user_id)
    const prices = await fetch('https://nailur.vercel.app/api/harga-emas').then(r=>r.json())
    const map = Object.fromEntries(prices.map(p=>[p.brand,p.price]))

    const result = rows.map(r=>{
      const age = monthsBetween(new Date(r.buy_date), new Date())
      const current = map[r.brand] * r.gram
      const profit = current - r.buy_price
      const growth = (profit / r.buy_price * 100).toFixed(2)
      return { ...r, age_month:age, current_price:current, profit, growth_pct:Number(growth) }
    })

    const summary = {
      total_gram: result.reduce((a,b)=>a+b.gram,0),
      total_buy: result.reduce((a,b)=>a+b.buy_price,0),
      total_wealth: result.reduce((a,b)=>a+b.current_price,0),
      total_profit: result.reduce((a,b)=>a+b.profit,0)
    }
    return res.json({ rows: result, summary })
  }

  if(req.method === 'POST'){
    const { brand, gram, buy_date, buy_price } = req.body
    await supabase.from('gold_portfolio').insert([{ user_id, brand, gram, buy_date, buy_price }])
    return res.json({ success:true })
  }

  res.status(405).end()
}
