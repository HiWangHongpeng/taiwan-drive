declare module 'gltf-validator' {
 export function validateBytes(data:Uint8Array,options?:{maxIssues?:number}):Promise<{issues:{numErrors:number;numWarnings:number;messages:{code:string;message:string;severity:number}[]}}>;
}
