(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,5773,t=>{"use strict";var e=t.i(43476),n=t.i(71645);function r({events:r}){let o=(0,n.useRef)(null),i=(0,n.useRef)(null),a=(0,n.useRef)(null);return(0,n.useEffect)(()=>{if(o.current&&!i.current)return t.A(71400).then(t=>{if(!o.current||i.current)return;let e=t.map(o.current,{center:[33.85,35.86],zoom:8,minZoom:7,zoomControl:!0});t.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',subdomains:"abcd",maxZoom:19}).addTo(e);let n=t.layerGroup().addTo(e);i.current=e,a.current=n}),()=>{i.current&&(i.current.remove(),i.current=null,a.current=null)}},[]),(0,n.useEffect)(()=>{i.current&&a.current&&t.A(71400).then(t=>{a.current&&(a.current.clearLayers(),r.forEach(e=>{let n=`
          <div style="
            position: relative;
            width: 36px;
            height: 36px;
            background: #1e1e2e;
            border: 2px solid #334155;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          ">
            ${e.event_icon}
            <div style="
              position: absolute;
              top: -6px;
              right: -6px;
              background: #ef4444;
              color: #fff;
              font-size: 9px;
              font-weight: 700;
              font-family: sans-serif;
              line-height: 1;
              padding: 2px 4px;
              border-radius: 10px;
              min-width: 16px;
              text-align: center;
            ">${e.event_count}</div>
          </div>`,r=t.divIcon({html:n,className:"",iconSize:[36,36],iconAnchor:[18,18],popupAnchor:[0,-22]}),o=t.marker([e.event_location.lat,e.event_location.lng],{icon:r});o.bindPopup(`
          <div style="font-family: sans-serif; min-width: 160px;">
            <div style="font-size: 22px; text-align: center; margin-bottom: 6px;">${e.event_icon}</div>
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 2px;">${e.event_label}</div>
            <div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">📍 ${e.event_location.name}</div>
            <div style="font-size: 12px; margin-bottom: 2px;">Count: <strong>${e.event_count}</strong></div>
            <div style="font-size: 11px; color: #94a3b8;">${e.date}</div>
          </div>
        `),a.current.addLayer(o)}))})},[r]),(0,e.jsx)("div",{className:"absolute inset-0",children:(0,e.jsx)("div",{ref:o,className:"w-full h-full"})})}t.s(["AtlasMap",()=>r])},16155,t=>{t.n(t.i(5773))},71400,t=>{t.v(e=>Promise.all(["static/chunks/9c09817456a99b20.js"].map(e=>t.l(e))).then(()=>e(32322)))}]);