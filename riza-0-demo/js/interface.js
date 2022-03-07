const RECORD_CREATED = 1;
const RECORD_UPDATED = 2;
const RECORD_DELETED = 3;

function log(msg) {
  console.log(msg);
  dv = document.createElement('div');
  txt = document.createTextNode(msg);
  dv.appendChild(txt);
  $('#log')[0].appendChild(dv);
}

function broadcastMessage(msg) {
  for (peer of window.peers) {
    if (peer.connection) {
      log('pushing through ' + peer.id);
      log(msg);
      peer.connection.send(msg);
    }
  }
}

function broadcastMessageToSubscribed(url, msg) {
  for (peer of window.peers) {
    if (peer.connection && peer.subscribed.includes(url)) {
      log('pushing through (subbed) ' + peer.id);
      peer.connection.send(msg);
    }
  }
}

function subscribeUrl(url) {
  log("subscribe to " + url);
  if (! window.subscribed.includes(url)) {
    window.subscribed.push(url);
  }
  broadcastMessage({'op' : 'subscribe', 'url' : url});
}

function subSub(p) {
  log("subscribing on new peer");
  for (url of window.subscribed) {
    log(url);
    log(p.connection);
    
    p.connection.send({'op' : 'subscribe', 'url' : url});
  }
}

function subscribeToTrackers(p) {
  for (tracker of window.trackersInside) {
    p.connection.send({'op' : 'subscribe', 'url' : tracker});
  }
}

function subscribeReadOnlyTracker(tracker) {
  log("using tracker "+tracker);
  // no real sub, just pull initial value from there
  $.get(tracker, function(data, status) {
    log("tracker status "+status);
    log(data);
    makeMoreConnections("", data);
  });
}

function receiveData(db, peer) {
  return async data => {
    log('====');
    log(data);
    if (data.op == 'update') {
      log('>> update ' + data.url);
      var c = await db.zero.get(data.url);
      if (! c || c.timestamp <= data.timestamp) {
	log('put '+data.data);
	db.zero.put({'url':data.url, 'timestamp':data.timestamp, 'data':data.data});
	log('updated');
      } else {
	log(c);
	log(data.timestamp);
	log('our version is more up to date');
      }
    } else if (data.op == 'subscribe') {
      log('>> subscribed to ' + data.url);
      if (peer.subscribed.includes(data.url)) {
	log('the peer is already subscribed');
      } else {
	peer.subscribed.push(data.url);
	var c = await db.zero.get(data.url);
	if (c) {
	  log(c);
	  peer.connection.send({'op':'update', 'url':c.url, 'timestamp':c.timestamp, 'data':c.data});
	  log('responded');
	} else {
	  log('not found');
	}
      }
    } else if (data.op == 'receive') {
      log('>> receive ' + data.url + " by "+peer.id);
      var c = await db.zero.get(data.url);
      if (c) {
	log(c);
	peer.connection.send({'op':'update', 'url':c.url, 'timestamp':c.timestamp, 'data':c.data});
	log('responded');
      } else {
	log('not found');
      }
    } else {
      log('unknown op');
      log(data);
    }
  };
}

function makePeer() {
  var peer = new Peer();
  window.peers.push(peer);
  peer.connection = null;
  peer.subscribed = [];
  return peer;
}

function connectToPeer(other_pid) {
  log(other_pid);
  var peer = makePeer();
  dv = document.createElement('div');
  peer.dom = dv;
  peer.on('open', (function(p) { return id => {
    txt = document.createTextNode(id);
    p.dom.appendChild(txt);
    log(id + ' <-> ' + other_pid);
    conn = p.connect(other_pid);
    p.connection = conn;
    conn.on('data', receiveData(db, p));
    conn.on('open', () => {
      subscribeToTrackers(p);
      subSub(p);
    });
  }})(peer));
  // peer.on('connection', (function(p) { return conn => {
    // log('#connectToPeer -> connection');
    // p.connection = conn;
    // $('#peerList')[0].appendChild(p.dom);
    // conn.on('data', receiveData(db, p));
    // subscribeToTrackers(p);
  // }})(peer));
}

async function trackersRemoveOpen(pid) {
  for (track of window.trackersInside) {
    var tr = await window.db.zero.get(track);
    if (!tr) {
      continue;
    }
    var opC = tr.data || '';
    log(opC);
    var r = opC.split('\n');
    let pos = r.indexOf(pid);
    if (pos >= 0) {
      r.splice(pos, 1);
    }
    let res = r.join('\n');
    window.db.zero.put({'url':track, 'timestamp':Date.now(), 'data':res});
  }
}

function makeMoreConnections(oldT, newT) {
  log('make more connections');
  o = oldT.split('\n');
  n = newT.split('\n');
  e = window.peers.map(peer => peer.id);

  // gather existing connections
  var count = 0;
  for (peer of window.peers) {
    if (peer.connection) {
      count += 1;
    }
  }

  var mod = false;
  
  if (count < 16) {
    var elig = [];
    for (p of n) {
      if (! o.includes(p) && ! e.includes(p)) {
	elig.push(p);
      }
    }
    if (elig.length > 0) {
      pick = elig[Math.trunc(Math.random()*elig.length)];
      // connect
      log('connecting to '+pick);
      connectToPeer(pick);
      var x = n.indexOf(pick);
      if (x >= 0) {
	n.splice(x, 1);
	mod = true;
      }
    }
  }

  for (peer of window.peers) {
    if (! n.includes(peer.id)) {
      n.push(peer.id);
      mod = true;
    }
  }
  
  return [n.join('\n'), mod]
}

function makePostNode(obj) {
  log('makePostNode');
  var datT = document.createTextNode((new Date(obj.timestamp * 1000)).toDateString());
  var datD = document.createElement('div');
  log('wtf 1!?#$');
  datD.appendChild(datT);
  datD.setAttribute('id', 'post_'+obj.post_id+'_date');
  datD.setAttribute('class', 'post_date');
  log('wtf 2!?#$');
  var pstT = document.createTextNode(obj.post);
  var pstD = document.createElement('div');
  pstD.appendChild(pstT);
  pstD.setAttribute('id', 'post_'+obj.post_id+'_post');
  var pst = document.createElement('div');
  pstD.setAttribute('class', 'post_post');
  pst.appendChild(datD);
  pst.appendChild(pstD);
  pst.setAttribute('id', 'post_'+obj.post_id+'_container');
  pst.setAttribute('class', 'post_container');
  log('wtf!?#$');
  var container = $('#container')[0];
  log(container);
  container.insertBefore(pst, container.firstChild);
  window.postNodes[obj.post_id] = {'update' : (function(pid){ obj => {
    $('#post_'+obj.post_id+'_date').text((new Date(obj.timestamp * 1000)).toDateString());
    $('#post_'+obj.post_id+'_post').text(obj.post);
  }})(obj.post_id)};
}

async function updateMe(data) {
  log('updateMe');
  log(data);
  var json = JSON.parse(data);
  var psts = json.post;

  var table = window.db.caryoscelus0me;

  for (var pst of psts) {
    log(pst);
    log(pst.post_id);
    table.put({'post_id':pst.post_id, 'timestamp':pst.date_added, 'post':pst.body});
  }
}

async function updateUi(url, data) {
  log('update ui @ '+url);
  if (url == $('#editUrl').val()) {
    log('url matched');
    log(data);
    $('#editText').val(data);
  }
}

async function zeroUpdated(url, oldobj, obj) {
  log('modified');
  await updateUi(url, obj.data);
  if (url == window.mainUrl) {
    await updateMe(obj.data);
  }
  var mod = false;
  var findata = obj.data;
  if (window.trackersInside.includes(url)) {
    [findata, mod] = makeMoreConnections(oldobj.data, obj.data);
    // addLocalPeers();
  }
  var ts = obj.timestamp;
  if (mod) {
    ts = Date.now();
  }
  broadcastMessageToSubscribed(url, {'op':'update', 'url':url, 'timestamp':ts, 'data':findata});
}

async function zeroChanged(change) {
  log('~~ zeroChanged ~~');
  log(change);
  if (change.table == 'zero') {
    log('zero');
    if (change.type == RECORD_CREATED) {
      log('created');
      var url = change.obj.url;
      var oldobj = {'url':url, 'timestamp':0, 'data':''};
      await zeroUpdated(url, oldobj, change.obj);
    } else if (change.type == RECORD_UPDATED) {
      log('>> updated');
      var url = change.obj.url;
      if (change.oldObj.data != change.obj.data) {
	await zeroUpdated(url, change.oldObj, change.obj);
      }
    } else if (change.type == RECORD_DELETED) {
      log('deleted');
    } else {
      log('!unknown change!');
    }
  } else if (change.table == 'caryoscelus0me') {
    log('change me');
    if (change.type == RECORD_CREATED) {
      new Notification(change.obj.post);
      makePostNode(change.obj);
    } else if (change.type == RECORD_UPDATED) {
      window.postNodes[change.obj.post_id].update(change.obj);
    } else if (change.type == RECORD_DELETED) {
      // TODO
    }
  } else {
    log('unknown change~~');
    log(change);
  }
}

function znOnRequest(cmd, msg) {
  log('unknown request '+cmd+' : '+msg);
}

function znOnMessage(e) {
  let message = e.data;
  let cmd = message.cmd;
  if (cmd == 'response') {
    if (this.waiting_cb[message.to] !== undefined) {
      window.zn_waiting_cb[message.to](message.result);
      delete window.zn_waiting_cb[message.to];
    } else {
      this.log("Websocket callback not found:", message)
    }
  } else if (cmd == 'wrapperReady') {
    znSend({'cmd':'innerReady', 'params':{}});
  } else if (cmd == 'ping') {
    // this.response(message.id, CMD_PONG)
  } else if (cmd == 'wrapperOpenedWebsocket') {
    // this.onOpenWebsocket()
  } else if (cmd == 'wrapperClosedWebsocket') {
    // this.onCloseWebsocket()
  } else {
    znOnRequest(cmd, message)
  }
}

function znSend(msg, cb=null) {
  msg.wrapper_nonce = window.zn_wrapper_nonce;
  msg.id = window.zn_next_message_id;
  ++window.zn_next_message_id;
  window.zn_target.postMessage(msg, '*')
  if (cb) {
    window.zn_waiting_cb[msg.id] = cb
  }
}

function znReadFile(fname, cb) {
  znSend({'cmd':'fileGet', 'params':[fname]}, cb);
}

function znWriteAndSign(fname, data) {
  znSend({'cmd':'fileWrite', 'params':[fname,data]}, res => {
    if (res == 'ok') {
      znSend({
	'cmd':'sitePublish',
	'params':{'inner_path':content_path, 'sign': true}
      }, () => {});
    } else {
      log(res);
    }
  });
}

function init0net() {
  window.zn_next_message_id = 1;
  window.zn_wrapper_nonce = document.location.href.replace(/.*wrapper_nonce=([A-Za-z0-9]+).*/, "$1");
  window.zn_target = window.parent;
  window.zn_waiting_cb = {};
  window.addEventListener('message', znOnMessage, false);
  znSend({'cmd':'innerReady', 'params':{}});
}

function rawjsInitInterface() {
  window.postNodes = {};
  
  window.mainUrl = "/1White24UrrwQrD86o6Vrc1apgZ1x1o51/data/users/13oRBYqNeUr6Tvgt4KkAT9FT4XRiKFBjnE/data.json";
  window.trackersReadOnly = ["https://zeronet.kaef.top/1EQ6gh2eV2crfxEGzmxMk8DHxULuSYyh4N/conns.txt"]; // web trackers
  window.trackersInside = ["/1EQ6gh2eV2crfxEGzmxMk8DHxULuSYyh4N/conns.txt"]; // riza-0 writeable trackers
  window.subscribed = [];

  var db = new Dexie("riza");
  db.version(2).stores({
    'zero' : 'url, timestamp, data'
  });
  db.version(3).stores({
    'caryoscelus0me' : 'post_id, timestamp, post'
  });
  db.version(5).stores({}); // for Observable
  window.db = db;

  db.open();

  // db.where('url').equals('/index/')
  // db.zero.hook('updating', zeroUpdated);
  db.on('changes', async changes => {
    log('=========');
    log('CHANGES');
    log(changes);
    for (var change of changes) {
      await zeroChanged(change);
    }
  });

  window.peers = [];

  var NPEER = 16;

  var connsDom = $('#connectionList')[0];

  connsDom.innerHTML = "";

  for (i = 0; i < NPEER; ++i) {
    var peer = makePeer();
    peer.on('open', (function(p) { return id => {
      log(id);
      dv = document.createElement('div');
      txt = document.createTextNode(id);
      dv.appendChild(txt);
      connsDom.appendChild(dv);
      p.dom = dv;
    }})(peer));
    peer.on('connection', (function(p) { return async conn => {
      log(conn);
      conn.on('data', receiveData(db, p));
      p.connection = conn;
      p.dom.remove();
      $('#peerList')[0].appendChild(p.dom);
      trackersRemoveOpen(p.id);
      subscribeToTrackers(p);
      subSub(p);
    }})(peer));
  };

  for (tracker of window.trackersInside) {
    subscribeUrl(tracker);
  }

  for (tracker of window.trackersReadOnly) {
    subscribeReadOnlyTracker(tracker);
  }

  setupUi();

  loadPosts();
}

function setupUi() {
  $('#update').click(async function() {
    var url = $('#editUrl').val();
    log("update " + url);
    var res = await db.zero.get(url);
    broadcastMessage({'op':'receive', 'url':url});
    log(res);
    if (! res || ! res.data) {
      $('#editText').val('');
    } else {
      $('#editText').val(res.data);
    }
  });
  
  $('#subscribe').click(function() {
    var url = $('#editUrl').val();
    subscribeUrl(url);
  });

  $('#editDone').click(function() {
    var url = $('#editUrl').val();
    var data = $('#editText').val();
    log("edit " + url);
    log(data);
    db.zero.put({'url':url, 'timestamp':Date.now(), 'data':data});
    log('#editDone');
  });

  $('#push').click(function() {
    var url = $('#editUrl').val();
    var data = $('#editText').val();
    log("push " + url);
    var ts = Date.now();
    db.zero.put({"url":url, "timestamp":ts, "data":data});
    broadcastMessage({'op' : 'update', 'url' : url, 'timestamp':ts, 'data' : data});
  });
  
  for (n of ['connections', 'peers', 'log', 'db', 'underhood']) {
    $('#' + n + 'Button').click((function(n){ return () => {
      var cns = $('#'+n)[0];
      if (cns.style.display === "none") {
	cns.style.display = "block";
      } else {
	cns.style.display = "none";
      }
    }})(n));
  }

  $('#connectToPeer').click(() => {
    log('connect');
    let other_pid = $('#remotePeer').val();
    connectToPeer(other_pid);
  });

  $('#zeroInit').click(init0net);

  subscribeUrl(window.mainUrl);

  // window.db.zero.get(window.mainUrl).
}

async function loadPosts() {
  $('#container').text('');
  window.db.zero.get(window.mainUrl).then(res => {
    if (res) {
      updateMe(res.data);
    }
    window.db.caryoscelus0me.toCollection().each(pst => {
      log('<!>==</i>');
      log(pst);
      makePostNode(pst);
      log('croot');
    });
  });
}
