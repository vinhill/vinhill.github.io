$(async function(){
	let getsql = initSqlJs();
	let getdb = fetch("https://github.com/vinhill/vinhill.github.io/blob/master/TTT/ttt.db", {
		method: 'GET',
		mode: 'no-cors'
	}).then(res => res.arrayBuffer());
	let SQL = await getsql;
	let buf = await getdb;
	const db = new SQL.Database(new Uint8Array(buf));
	var res = db.exec("SELECT * FROM player");
	console.log(res);
})