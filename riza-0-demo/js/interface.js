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
      log("pushing to" + peer.connection);
      peer.connection.send(msg);
    }
  }
}

function broadcastMessageToSubscribed(url, msg) {
  for (peer of window.peers) {
    if (peer.connection && peer.subscribed.includes(url)) {
      log("pushing to" + peer.connection);
      peer.connection.send(msg);
    }
  }
}

function subscribeUrl(url) {
  log("subscribe to " + url);
  broadcastMessage({'op' : 'subscribe', 'url' : url});
  window.subscribed.push(url);
}

function subscribeToTrackers(p) {
  for (tracker of window.trackersInside) {
    p.connection.send({'op' : 'subscribe', 'url' : tracker});
  }
}

function receiveData(db, peer) {
  return data => {
    if (data.op == 'update') {
      log('>> update' + data.url);
      log(data.data);
      db.zero.put({'url':data.url, 'data':data.data});
    } else if (data.op == 'subscribe') {
      log('>> subscribed to ' + data.url);
      peer.subscribed.push(data.url);
    } else {
      log('unknown op');
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
  }})(peer));
  peer.on('connection', (function(p) { return conn => {
    log('#connectToPeer -> connection');
    p.connection = conn;
    $('#peerList')[0].appendChild(p.dom);
    conn.on('data', receiveData(db, p));
  }})(peer));
}

async function trackersRemoveOpen(pid) {
  for (track of window.trackersInside) {
    var opC = await window.db.zero.get(track) || '';
    var r = opC.split('\n');
    let pos = r.indexOf(pid);
    if (pos >= 0) {
      r.splice(pos, 1);
    }
    let res = r.join('\n');
    window.db.zero.put({'url':track, 'data':res});
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
    }
  }
}

async function zero_updated(modifications, primKey, obj, transaction) {
  log('zero updating')
  // log(primKey);
  // log(obj);
  // log(transaction);
  var url = obj.url;
  var modified = false;
  var current_val = await window.db.zero.where("url").equals(url).toArray();
  log("current value: " + current_val[0].data);
  log("new value " + modifications.data)
  
  if (modifications.data && modifications.data != obj.data) {
    log('MODIFIED');

    broadcastMessageToSubscribed(url, {'op':'update', 'url':url, data:modifications.data});

    if (obj.url == $('#editUrl').val()) {
      log('URL');
      $('#editText').val(modifications.data);
    }
    if (window.trackersInside.includes(obj.url)) {
      makeMoreConnections(obj.data, modifications.data);
    }
  }
}

function rawjsInitInterface() {
  window.trackersReadOnly = []; // web trackers
  window.trackersInside = ["/1EQ6gh2eV2crfxEGzmxMk8DHxULuSYyh4N/conns.txt"]; // riza-0 writeable trackers
  window.subscribed = [];

  var db = new Dexie("riza");
  db.version(1).stores({
    // peers : 'address',
    zero : 'url, data'
  });
  window.db = db;

  db.open();

  // db.where('url').equals('/index/')
  db.zero.hook('updating', zero_updated);

  $('#update').click(async function() {
    var url = $('#editUrl').val();
    log("update " + url);
    const res = await db.zero.where("url").equals(url).toArray();
    if (res.length < 1) {
      $('#editText').val('');
    } else {
      $('#editText').val(res[0].data);
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
    db.zero.put({"url":url, "data":data});
  });

  $('#push').click(function() {
    var url = $('#editUrl').val();
    var data = $('#editText').val();
    log("push " + url);
    db.zero.put({"url":url, "data":data});
    broadcastMessage({'op' : 'update', 'url' : url, 'data' : data});
  });
  
  for (n of ['connections', 'peers', 'log', 'db']) {
    $('#' + n + 'Button').click((function(n){ return () => {
      var cns = $('#'+n)[0];
      if (cns.style.display === "none") {
	cns.style.display = "block";
      } else {
	cns.style.display = "none";
      }
    }})(n));
  }

  window.peers = [];

  var NPEER = 2;

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
    }})(peer));
  };

  $('#connectToPeer').click(() => {
    log('connect');
    let other_pid = $('#remotePeer').val();
    connectToPeer(other_pid);
  });

  for (tracker of window.trackersInside) {
    subscribeUrl(tracker);
  }

}
