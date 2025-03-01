import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Hash, Type, List, Box, FileText, BrainCircuit, Code, Globe, Circle, CircleSmall, Brackets, ArrowUpRightFromSquareIcon, MoveRight, MoveLeft } from 'lucide-react';
import { JsonObjectId, JsonObjectStruct } from '../core/jobject';

// Tree Node Component
const ObjectTreeNode: React.FC<{
  struct: JsonObjectStruct,
  id: JsonObjectId,
  slotPath: string,
  slotName: string;
  depth: number;
  isRoot?: boolean;
  open_objects: Set<string>;
  toggleOpenObject: (object_path: string) => void;
}> = ({ struct, id, slotPath, slotName, depth, isRoot = false, open_objects, toggleOpenObject }) => {
  const object = struct.objects.get(id)!;
  //const [isOpen, setIsOpen] = useState(depth <= 2 || isRoot);
  const isOpen = open_objects.has(slotPath);
  const indent = isRoot ? '' : `ml-${depth * 4}`;
  
  
  // Determine icon based on type
  const getIcon = () => {
    if (object.kind == "list") {
      return <Brackets className="text-blue-500" size={16} />;
    }
    if (object.kind?.length ?? 0 > 0) {
      return <CircleSmall className="text-blue-500" size={16} />;
    }
    return <Globe className="text-purple-600" size={16} />
    /*if (isRoot) {
      return <Globe className="text-purple-600" size={16} />;
    }
    
    switch (data.type) {
      case 'dict':
        return <Box className="text-blue-500" size={16} />;
      case 'list':
        return <List className="text-green-500" size={16} />;
      case 'dataclass':
        return <BrainCircuit className="text-purple-500" size={16} />;
      case 'int':
      case 'float':
        return <Hash className="text-amber-500" size={16} />;
      case 'str':
        return <FileText className="text-red-500" size={16} />;
      case 'function':
        return <Type className="text-gray-500" size={16} />;
      case 'opaque':
        return <Code className="text-indigo-500" size={16} />;
      default:
        return <Type className="text-gray-500" size={16} />;
    }*/
  };
  
  // Format primitive values
  const formatValue = () => {
    return <span className="text-amber-600">{object?.repr}{object?.value_type && <span className="font-bold" >: {object?.value_type}</span>}</span>
    /*
    if (['int', 'float', 'bool', 'none'].includes(data.type)) {
      return <span className="text-amber-600">{String(datna.value)}</span>;
    } else if (data.type === 'str') {
      return <span className="text-green-600">"{data.value}"</span>;
    } else if (data.type === 'function') {
      return <span className="text-gray-600">{data.value as string}()</span>;
    } else if (data.type === 'opaque') {
      return <span className="text-indigo-600 font-mono text-sm">{data.repr}</span>;
    }
    return null;*/
  };
  
  const hasChildren = object.children?.length ?? 0 > 0;

  // Render children
  const renderChildren = () => {
    if (!hasChildren || !isOpen) return null;
    return object.children!.map(([slotName, child]) => (
        <ObjectTreeNode 
          key={slotName}
          slotName={slotName}
          slotPath={`${slotPath}/${slotName}`}
          struct={struct}
          id={child}
          depth={depth + 1}
          open_objects={open_objects}
          toggleOpenObject={toggleOpenObject}
        />
      ));
  };
  
  return (
    <div className={isRoot ? "pb-1 mb-1" : ""}>
      <div className={`flex items-center py-1 ${indent} rounded ${isRoot ? "bg-gray-100 p-2 hover:bg-gray-300" : "hover:bg-gray-50"}`}>
        {hasChildren ? (
          <button onClick={() => toggleOpenObject(slotPath)} className="mr-1 focus:outline-none">
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="mr-1 w-4"></span>
        )}
        {getIcon()}
        <span className={`mx-1 font-mono ${isRoot ? "" : ""}`}>
            <span className={`${isRoot ? "text-blue-800" : "text-blue-800"}`}>
              {slotName}
            </span>{': '}
            {/* {data.type === 'dataclass' ? (
              <span className="text-purple-800">{data.name || 'DataClass'}</span>
            ) : data.type === 'dict' ? (
              <span className="text-blue-800">{'{'}</span>
            ) : data.type === 'list' ? (
              <span className="text-green-800">[</span>
            ) : (
              formatValue(data)
            )} */}
            {formatValue()}
        </span>
        {/* {hasChildren && !isOpen && (
          <span className="text-gray-400 text-sm">
           {`${object.children?.length} items`}
          </span>
        )} */}
      </div>
      {renderChildren()}
      {/* {hasChildren && isOpen && (
        <div className={`${indent} ml-8 font-mono`}>
          {data.type === 'dict' ? '}' : data.type === 'list' ? ']' : ''}
        </div>
      )} */}
    </div>
  );
};

export default ObjectTreeNode;
// // Main component
// const GlobalTreeView: React.FC<{
//   data: PythonObject;
//   title?: string;
//   globalName?: string;
// }> = ({ data, title = "Python Object Tree", globalName }) => {
//   return (
//     <div className="w-full max-w-4xl border rounded-lg shadow bg-white">
//       <div className="p-4 border-b bg-gray-50">
//         <h3 className="text-lg font-medium text-gray-800">{title}</h3>
//         {globalName && (
//           <p className="text-sm text-gray-500">Global variable: <code className="bg-gray-200 px-1 py-0.5 rounded">{globalName}</code></p>
//         )}
//       </div>
//       <div className="p-4 overflow-auto">
//         <TreeNode data={data} name={globalName || "globals"} depth={0} isRoot={true} />
//       </div>
//     </div>
//   );
// };

// // Demo component
// const Demo: React.FC = () => {
//   // Sample Python object structure
//   const sampleData: PythonObject = {
//     type: 'dict',
//     value: {
//       'user': {
//         type: 'dataclass',
//         name: 'User',
//         value: {
//           'id': { type: 'int', value: 42 },
//           'name': { type: 'str', value: 'John Doe' },
//           'is_admin': { type: 'bool', value: false },
//           'profile': {
//             type: 'dict',
//             value: {
//               'bio': { type: 'str', value: 'Python developer and React enthusiast' },
//               'joined_date': { type: 'str', value: '2023-01-15' }
//             }
//           },
//           'custom_object': {
//             type: 'opaque',
//             value: null,
//             repr: "<__main__.MyClass at 0x7a77bd416510>"
//           }
//         }
//       },
//       'posts': {
//         type: 'list',
//         value: [
//           {
//             type: 'dict',
//             value: {
//               'id': { type: 'int', value: 1 },
//               'title': { type: 'str', value: 'Getting Started with TypeScript' },
//               'tags': {
//                 type: 'list',
//                 value: [
//                   { type: 'str', value: 'typescript' },
//                   { type: 'str', value: 'javascript' },
//                   { type: 'str', value: 'web' }
//                 ]
//               }
//             }
//           },
//           {
//             type: 'dict',
//             value: {
//               'id': { type: 'int', value: 2 },
//               'title': { type: 'str', value: 'Python Data Structures' },
//               'tags': {
//                 type: 'list',
//                 value: [
//                   { type: 'str', value: 'python' },
//                   { type: 'str', value: 'programming' }
//                 ]
//               },
//               'metadata': {
//                 type: 'opaque',
//                 value: null,
//                 repr: "<__main__.PostMetadata at 0x7a77bd416520>"
//               }
//             }
//           }
//         ]
//       },
//       'settings': {
//         type: 'dict',
//         value: {
//           'theme': { type: 'str', value: 'dark' },
//           'notifications': { type: 'bool', value: true },
//           'methods': {
//             type: 'dict',
//             value: {
//               'save': { type: 'function', value: 'save_settings' },
//               'reset': { type: 'function', value: 'reset_settings' }
//             }
//           }
//         }
//       },
//       'stats': {
//         type: 'dict',
//         value: {
//           'views': { type: 'int', value: 1250 },
//           'likes': { type: 'int', value: 75 },
//           'ratio': { type: 'float', value: 0.06 }
//         }
//       },
//       'complex_objects': {
//         type: 'list',
//         value: [
//           { 
//             type: 'opaque', 
//             value: null, 
//             repr: "<__main__.ComplexObject at 0x7a77bd416530>" 
//           },
//           { 
//             type: 'opaque', 
//             value: null, 
//             repr: "<__main__.ComplexObject at 0x7a77bd416540>" 
//           },
//           { 
//             type: 'opaque', 
//             value: null, 
//             repr: "<builtins.filter object at 0x7a77bd416550>" 
//           }
//         ]
//       }
//     }
//   };

//   return (
//     <div className="p-4">
//       <GlobalTreeView 
//         data={sampleData} 
//         title="Python Object Structure Example"
//         globalName="app_data"
//       />
//     </div>
//   );
// };

// export default Demo;