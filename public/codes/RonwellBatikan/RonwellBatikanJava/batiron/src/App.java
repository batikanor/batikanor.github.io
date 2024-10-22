public class App {
    public static void main(String[] args) throws Exception {
        System.out.println("Hello, World!");
        SolutionTwo s2 = new SolutionTwo();
        System.out.println(s2.solution(2014,"April","May","Wednesday"));

        SolutionThree s3 = new SolutionThree();
        int N = 4;
        int a[] = new int[]{1,2,4,4,3};
        int b[] = new int[]{2,3,1,3,1};
        System.out.println(s3.solution(N, a, b));

        
        N = 4;
        a = new int[]{1,2,1,3};
        b = new int[]{2,4,3,4};
        System.out.println(s3.solution(N, a, b));


        N = 6;
        a = new int[]{2,4,5,3};
        b = new int[]{3,5,6,4};
        System.out.println(s3.solution(N, a, b));




    }
}
