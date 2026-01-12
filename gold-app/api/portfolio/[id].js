
import { supabase } from '../../lib/supabase'

export default async function handler(req,res){
  const { id } = req.query
  const user_id = req.query.user_id

  if(req.method === 'PUT'){
    const { brand, gram, buy_date, buy_price } = req.body
    await supabase.from('gold_portfolio').update({ brand, gram, buy_date, buy_price }).eq('id', id).eq('user_id', user_id)
    return res.json({ success:true })
  }

  if(req.method === 'DELETE'){
    await supabase.from('gold_portfolio').delete().eq('id', id).eq('user_id', user_id)
    return res.json({ success:true })
  }

  res.status(405).end()
}
