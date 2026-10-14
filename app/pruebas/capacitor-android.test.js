import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidirAtrasAndroid, homeAutorizado } from '../src/lib/atrasAndroidCapacitor.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read = p => readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('capacitor.config.json'));

test('Capacitor empaqueta dist local sin abrir URL remota y usa ID propio',()=>{
  assert.equal(manifest.appId,'cl.coproactiva.appdiaria');
  assert.equal(manifest.webDir,'dist');
  assert.equal(manifest.appName,'Coproactiva App Diaria');
  assert.equal(manifest.server?.url,undefined);
  assert.equal(manifest.android.allowMixedContent,false);
  assert.match(read('vite.config.js'),/CAPACITOR_BUILD === 'true'/);
  assert.match(read('src/main.jsx'),/!Capacitor\.isNativePlatform\(\)/);
  assert.ok(existsSync(path.join(root,'dist','index.html')));
});

test('Atrás Android llega a Home según los permisos reales',()=>{
  for(const rol of ['superadmin','admin','jefatura']){
    assert.equal(homeAutorizado(rol),'/');
    assert.deepEqual(decidirAtrasAndroid({pathname:'/seo',rol,indice:0}),{
      tipo:'home',destino:'/'
    });
    assert.deepEqual(decidirAtrasAndroid({pathname:'/',rol,indice:9}),{
      tipo:'salir'
    });
    assert.deepEqual(decidirAtrasAndroid({pathname:'/control/7',rol,indice:2}),{
      tipo:'historial',pasos:-1
    });
  }
  assert.equal(homeAutorizado('cliente'),'/portal');
  assert.deepEqual(decidirAtrasAndroid({pathname:'/portal/comunidades/7',rol:'cliente',indice:0}),{
    tipo:'home',destino:'/portal'
  });
  assert.deepEqual(decidirAtrasAndroid({pathname:'/portal',rol:'cliente',indice:8}),{
    tipo:'salir'
  });
  assert.equal(homeAutorizado('terreno'),'/inicio');
  assert.deepEqual(decidirAtrasAndroid({pathname:'/inicio',rol:'terreno',indice:2}),{
    tipo:'salir'
  });
  assert.deepEqual(decidirAtrasAndroid({pathname:'/ingreso',rol:undefined,indice:0}),{
    tipo:'salir'
  });
});

test('el comportamiento nativo se registra solo en Android y respeta formularios',()=>{
  const comp=read('src/componentes/AtrasNativoAndroid.jsx');
  const app=read('src/App.jsx');
  assert.match(comp,/Capacitor\.isNativePlatform\(\)/);
  assert.match(comp,/Capacitor\.getPlatform\(\) !== 'android'/);
  assert.match(comp,/addListener\('backButton'/);
  assert.match(comp,/coproactiva:volver/);
  assert.match(comp,/evento\.defaultPrevented/);
  assert.match(comp,/CapacitorApp\.exitApp\(\)/);
  assert.match(app,/<AtrasNativoAndroid \/>/);
});

test('recursos Android generados y permisos seguros',()=>{
  const main='android/app/src/main/';
  const androidManifest=read(main+'AndroidManifest.xml');
  assert.match(androidManifest,/android:allowBackup="false"/);
  assert.match(androidManifest,/android:usesCleartextTraffic="false"/);
  const iconos=[
    'android/app/src/main/res/mipmap-mdpi/ic_launcher.png',
    'android/app/src/main/res/mipmap-hdpi/ic_launcher.png',
    'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png',
    'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png',
    'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
    'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
    'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml'
  ];
  for(const p of iconos)assert.ok(existsSync(path.join(root,p)),p);
  assert.match(read('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml'),
    /coproactiva_launcher_bg/);
});
