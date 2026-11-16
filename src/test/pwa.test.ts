import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
describe("PWA install and cache safety contract",()=>{
const manifest=JSON.parse(readFileSync(resolve(process.cwd(),"public/manifest.webmanifest"),"utf8")) as {display:string;lang:string;icons:Array<{src:string;sizes:string;purpose:string}>};
const worker=readFileSync(resolve(process.cwd(),"public/sw.js"),"utf8");
it("declares standalone Bengali app metadata and required icon sizes",()=>{expect(manifest.display).toBe("standalone");expect(manifest.lang).toBe("bn");expect(manifest.icons.some(i=>i.sizes==="192x192")).toBe(true);expect(manifest.icons.some(i=>i.sizes==="512x512"&&i.purpose==="maskable")).toBe(true);});
it("never caches API responses, HTML navigation or query-bearing requests",()=>{expect(worker).toContain('url.pathname.startsWith("/api/")');expect(worker).toContain('url.pathname === "/"');expect(worker).toContain("url.search");expect(worker).toContain("request.method !== \"GET\"");});
});
