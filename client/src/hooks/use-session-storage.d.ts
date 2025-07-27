declare module "@/hooks/use-session-storage" {
    import { useState } from 'react';

    function useSessionStorage<T> ( key: string, initialValue: T ): [ T, ( value: T ) => void ];
    export { useSessionStorage };
}
