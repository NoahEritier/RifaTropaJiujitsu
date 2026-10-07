export type DrawResult = {winner:number; created:number; start:number};
export type DrawState = {approved:number; start:number; result:DrawResult|null};
export const insertDrawSql = `
INSERT INTO raffle_draw(id,winner,request_id,created,start,snapshot)
SELECT 1,t.number,t.request_id,?,?,
 (SELECT json_group_array(json_object('number',number,'requestId',request_id))
  FROM (SELECT t.number,t.request_id FROM tickets t JOIN requests r ON r.id=t.request_id WHERE r.status='approved' ORDER BY t.number))
FROM tickets t JOIN requests r ON r.id=t.request_id
WHERE t.number=? AND r.status='approved'
 AND NOT EXISTS(SELECT 1 FROM raffle_draw)
 AND (SELECT COUNT(*) FROM tickets t JOIN requests r ON r.id=t.request_id WHERE r.status='approved' AND t.number BETWEEN ? AND ?)=100
 AND (SELECT json_extract(value,'$.start') FROM settings WHERE id=1)=?
 AND (SELECT json_extract(value,'$.numberingConfirmed') FROM settings WHERE id=1)=1
`;
