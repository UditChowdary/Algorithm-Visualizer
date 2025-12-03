def bubble_sort(arr):
    n = len(arr)
    arr = arr.copy()
    for i in range(n):
        for j in range(0, n - i - 1):
            yield {'array': arr, 'compare': [j, j+1]}
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
                yield {'array': arr, 'swap': [j, j+1]}
    yield {'array': arr, 'sorted': True}
