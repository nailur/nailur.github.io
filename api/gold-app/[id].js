import { getSupabase } from '../../lib/supabase'

export default async function handler(req,res){
  const supabase = getSupabase(req)
  const { data:{ user }} = await supabase.auth.getUser()
  if(!user) return res.status(401).end()

  const { id } = req.query

  if(req.method === 'PUT'){
    await supabase.from('gold_portfolio').update(req.body).eq('id',id)
    return res.json({ success:true })
  }

  if(req.method === 'DELETE'){
    await supabase.from('gold_portfolio').delete().eq('id',id)
    return res.json({ success:true })
  }
}