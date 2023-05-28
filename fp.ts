namespace fp
{
    type F<T, R> = (p: T) => R ;
    
    export 
    const memoize = 
    <T extends (...args: any[]) => any>(fn: T)
    : T => 
    {
        const cache: Record<string, ReturnType<T>> = {};
        
        return ((...args: Parameters<T>)
        : ReturnType<T> => 
        {
            const key = JSON.stringify(args) ;
            if (!(key in cache)) 
            { cache[key] = fn(...args); } ;
            return cache[key] ;
        }) as T ;
    } ;
    
    export 
    const apply = 
    (f: Function, args: any[])
    : any => 
        f(...args) ;
    
    export 
    const applieds = memoize(apply) ;
    
    
    export 
    class Pipe
    <T> 
    {
        constructor 
        (private readonly value: T, private readonly fns: F<any, any>[] = []) 
        {} ;
        
        
        readonly then = 
        <R,>(fn: F<T, R>)
        : Pipe<R> => 
        {
            this.fns.push(fn);
            return (this as unknown) as Pipe<R> ;
        } ;
        
        private static readonly piperun = memoize
        (
            <T,> (fs: F<any, any>[], v: T)
            : T => 
                fs.reduce((r, f) => f(r), v)
        ) ;
        
        private readonly runfn = 
        ()
        : T => 
            
            Pipe.piperun(this.fns, this.value) ;
        
        readonly run = 
        ()
        : Pipe<T> => 
            
            new Pipe(this.runfn()) ;
        
        
        
        readonly pipi = 
        <R,>
        (fn: F<T, R>)
        : Pipe<T> => 
        {
            fn(this.runfn()) ;
            return new Pipe(this.value, this.fns) ;
        } ;
        
        readonly pop = 
        (): T => this.value ;
    } ;
    
    export 
    class Stream
    <T> 
    {
        
        generatorFunction: () => Generator<T> ;
        
        constructor(generatorFunction: () => Generator<T>)
        { this.generatorFunction = generatorFunction ; } ;
        
        static iterate
        <T>(initialValue: T, f: (value: T) => T)
        : Stream<T> 
        {
            return new Stream
            ( function* ()
            : Generator<T> 
            {
                let value = initialValue ;
                while (true) 
                {
                    yield value ;
                    value = f(value) ;
                } ;
            } ) ;
        } ;
        
        static unfold
        <T, R>(initialValue: T, f: (value: T) => { mapper: R; iter: T } | undefined)
        : Stream<R> 
        {
            return new Stream
            ( function* ()
            : Generator<R> 
            {
                let value = initialValue ;
                while (true) 
                {
                    const next = f(value) ;
                    if (next === undefined) break ;
                    yield next.mapper ;
                    value = next.iter ;
                } ;
            } ) ;
        } ;
        
        map
        <R>(f: (value: T) => R)
        : Stream<R> 
        {
            return new Stream
            (( function* (this: Stream<T>)
            : Generator<R> 
            {
                const iterator = this.generatorFunction() ;
                while (true) 
                {
                    const { value, done } = iterator.next() ;
                    if (done) break ;
                    yield f(value) ;
                } ;
            } ).bind(this)) ;
        } ;
        
        filter
        (predicate: (value: T) => boolean)
        : Stream<T> 
        {
            return new Stream
            (( function* (this: Stream<T>)
            : Generator<T> 
            {
                const iterator = this.generatorFunction() ;
                while (true) 
                {
                    const { value, done } = iterator.next() ;
                    if (done) break ;
                    if (predicate(value)) yield value ;
                }
            } ).bind(this)) ;
        } ;
        
        takeUntil
        (predicate: (value: T) => boolean)
        : T[] 
        {
            const result: T[] = [] ;
            const iterator = this.generatorFunction() ;
            while (true) 
            {
                const { value, done } = iterator.next() ;
                result.push(value) ;
                if (done || predicate(value)) break ;
            } ;
            return result ;
        }
        
        take
        (n: number)
        : T[] 
        {
            let count = 1 ;
            return this.takeUntil(() => !(count++ < n)) ;
        } ;
    } ;
    
    export 
    class TailCall
    <T> 
    {
        constructor
        (
            public readonly isComplete: boolean ,
            public readonly result: T ,
            public readonly nextCall: () => TailCall<T> ,
        ) {} ;
        
        static done
        <T>(value: T)
        : TailCall<T> 
        {
            return new TailCall(true, value, () => { throw new Error("not implemented"); }) ;
        } ;
        
        static call
        <T>(nextCall: () => TailCall<T>)
        : TailCall<T> 
        {
            return new TailCall(false, null as any, nextCall);
        } ;
        
        invoke
        (): T 
        {
            return Stream
                .iterate(this as TailCall<T>, x => (x.nextCall()))
                .takeUntil(x => x.isComplete)
                .reduce((_, x) => x.result, this.result) ;
        } ;
    } ;
} ;

namespace Demos
{
    namespace Memoizes
    {
        export const test0 = () =>
        {
            const fib = fp.memoize((n: number): number => (n <= 1 ? n : fib(n - 1) + fib(n - 2)) ) ;
            console.log(fib(40));
            console.log(fib(40));
        } ;
        
    } ;
    Memoizes.test0();
    
    namespace Pipes
    {
        export const test0 = () =>
        {
            var y, z;
            const result = new fp.Pipe(1)
                .then(x => x + 1)
                .then(x => x * x)
                .then(x => x.toString())
                .then(x => x.toString())
                .run()
                .then(x => x + 5)
                .then(x => x + 0)
                .pipi(x => (y = x + 1))
                .pipi(x => (z = x + 1))
                .then(x => x + "c")
                // .run()
                .pop();
            
            console.log(result);
            console.log(y);
            console.log(z);
        } ;
        
    } ;
    Pipes.test0();
    
    
    
    namespace Applies
    {
        export const test0 = () =>
        {
            console.log(fp.apply((a: number) => a+12, [3]) );
        } ;
        
        export const test1 = () =>
        {
            new fp.Pipe(fp.apply((a: number, b: string) => b + (a*2), [3, "x"]) )
                .then(x => console.log(x))
                .run();
        } ;
    } ;
    Applies.test0();
    Applies.test1();
    
    
} ;

